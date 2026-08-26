-- bizko — Fase 5: inventario, existencias y movimientos
--
-- products ya tenía track_stock/stock_quantity/low_stock_threshold desde la
-- Fase 1 (enteros, sin trazabilidad). Se renombran al vocabulario de esta
-- fase y se cambian a numeric para soportar cantidades decimales (kg, litros).
-- La tabla `inventory` de la Fase 1 era una fuente de verdad redundante con
-- products.current_stock — se elimina; el stock vive en un solo lugar.
-- inventory_movements se completa con tipo, stock anterior/nuevo y referencia,
-- y se agrega apply_inventory_movement(): la única forma permitida de
-- cambiar el stock, siempre con su movimiento asociado (nunca un UPDATE directo).

create type inventory_movement_type as enum ('in', 'out', 'adjustment', 'return');

drop table if exists inventory;

alter table products rename column track_stock to track_inventory;
alter table products alter column stock_quantity type numeric using stock_quantity::numeric;
alter table products rename column stock_quantity to current_stock;
alter table products alter column low_stock_threshold type numeric using low_stock_threshold::numeric;
alter table products rename column low_stock_threshold to minimum_stock;

alter table inventory_movements rename column quantity_delta to quantity;
alter table inventory_movements
  add column if not exists movement_type inventory_movement_type not null default 'adjustment',
  add column if not exists previous_stock numeric not null default 0,
  add column if not exists new_stock numeric not null default 0,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists user_id uuid references auth.users (id);
alter table inventory_movements alter column movement_type drop default;

-- Para embeber el nombre del usuario (select("*, user:profiles(*)")) igual
-- que en ventas — ver el comentario equivalente en 0006_sales.sql.
alter table inventory_movements
  add constraint inventory_movements_user_id_profiles_fkey
  foreign key (user_id) references profiles (id);

create index inventory_movements_product_id_idx on inventory_movements (product_id, created_at desc);
create index products_low_stock_idx on products (company_id, track_inventory, current_stock);

-- =========================================================================
-- RPC: única vía para modificar el stock. Bloquea la fila del producto,
-- calcula el nuevo stock, impide negativos y registra el movimiento.
-- =========================================================================
create function apply_inventory_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_movement_type inventory_movement_type,
  p_quantity numeric,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns inventory_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
  v_previous numeric;
  v_new numeric;
  v_signed_qty numeric;
  v_movement inventory_movements;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select * into v_product from products
    where id = p_product_id and company_id = p_company_id
    for update;

  if v_product.id is null then
    raise exception 'Producto no encontrado.';
  end if;
  if not v_product.track_inventory then
    raise exception 'Este producto no tiene control de inventario activado.';
  end if;
  if p_quantity is null or (p_movement_type != 'adjustment' and p_quantity <= 0) then
    raise exception 'La cantidad debe ser mayor a 0.';
  end if;

  v_previous := v_product.current_stock;
  v_signed_qty := case p_movement_type
    when 'out' then -abs(p_quantity)
    when 'in' then abs(p_quantity)
    when 'return' then abs(p_quantity)
    else p_quantity -- adjustment: ya viene firmado (+/-)
  end;
  v_new := v_previous + v_signed_qty;

  if v_new < 0 then
    raise exception 'No hay suficiente inventario disponible. Stock actual: %.', v_previous;
  end if;

  update products set current_stock = v_new, updated_at = now() where id = p_product_id;

  insert into inventory_movements (
    company_id, product_id, movement_type, quantity, previous_stock, new_stock,
    reason, reference_type, reference_id, user_id
  ) values (
    p_company_id, p_product_id, p_movement_type, v_signed_qty, v_previous, v_new,
    nullif(trim(p_reason), ''), p_reference_type, p_reference_id, auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

grant execute on function apply_inventory_movement to authenticated;

-- =========================================================================
-- create_sale(): se reemplaza para descontar inventario automáticamente
-- (solo productos con track_inventory = true; los servicios nunca afectan
-- stock). Si no hay suficiente inventario, apply_inventory_movement aborta
-- toda la transacción: la venta no se crea.
-- =========================================================================
create or replace function create_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_payment_method payment_method,
  p_discount_cents integer,
  p_notes text,
  p_items jsonb
)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales;
  v_seq integer;
  v_subtotal integer := 0;
  v_item jsonb;
  v_quantity numeric;
  v_unit_price integer;
  v_item_discount integer;
  v_item_total integer;
  v_product_id uuid;
  v_track_inventory boolean;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto o servicio.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price_cents')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a 0.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio debe ser mayor o igual a 0.';
    end if;
    v_item_discount := coalesce((v_item ->> 'discount_cents')::integer, 0);
    v_subtotal := v_subtotal + round(v_unit_price * v_quantity)::integer - v_item_discount;
  end loop;

  update companies set sales_sequence = sales_sequence + 1
    where id = p_company_id
    returning sales_sequence into v_seq;

  insert into sales (
    company_id, customer_id, user_id, sale_number,
    subtotal_cents, discount_cents, tax_cents, total_cents,
    payment_method, status, notes
  )
  values (
    p_company_id,
    p_customer_id,
    auth.uid(),
    'V-' || lpad(v_seq::text, 6, '0'),
    v_subtotal,
    coalesce(p_discount_cents, 0),
    0,
    greatest(v_subtotal - coalesce(p_discount_cents, 0), 0),
    p_payment_method,
    'completed',
    nullif(trim(p_notes), '')
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price_cents')::integer;
    v_item_discount := coalesce((v_item ->> 'discount_cents')::integer, 0);
    v_item_total := round(v_unit_price * v_quantity)::integer - v_item_discount;
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;

    insert into sale_items (
      sale_id, product_id, service_id, item_type, name, quantity,
      unit_price_cents, discount_cents, total_cents
    ) values (
      v_sale.id,
      v_product_id,
      nullif(v_item ->> 'service_id', '')::uuid,
      (v_item ->> 'item_type')::sale_item_type,
      v_item ->> 'name',
      v_quantity,
      v_unit_price,
      v_item_discount,
      v_item_total
    );

    if v_product_id is not null then
      select track_inventory into v_track_inventory from products where id = v_product_id;
      if v_track_inventory then
        perform apply_inventory_movement(
          p_company_id, v_product_id, 'out', v_quantity,
          'Venta ' || v_sale.sale_number, 'sale', v_sale.id
        );
      end if;
    end if;
  end loop;

  return v_sale;
end;
$$;

-- =========================================================================
-- RPC: anular venta. Revierte el stock de los productos que lo descontaron
-- (movimiento 'return'), sin tocar el historial de movimientos anterior.
-- =========================================================================
create function void_sale(p_sale_id uuid)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale sales;
  v_item record;
  v_track_inventory boolean;
  v_is_owner_or_manager boolean;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Venta no encontrada.';
  end if;
  if v_sale.status != 'completed' then
    raise exception 'Solo se pueden anular ventas completadas.';
  end if;

  select exists (
    select 1 from company_members
    where company_id = v_sale.company_id and user_id = auth.uid()
      and role in ('owner', 'manager') and status = 'active'
  ) or is_platform_admin() into v_is_owner_or_manager;

  if not v_is_owner_or_manager then
    raise exception 'No tienes permiso para anular ventas.';
  end if;

  update sales set status = 'voided', updated_at = now()
    where id = p_sale_id
    returning * into v_sale;

  for v_item in
    select * from sale_items where sale_id = p_sale_id and item_type = 'product' and product_id is not null
  loop
    select track_inventory into v_track_inventory from products where id = v_item.product_id;
    if v_track_inventory then
      perform apply_inventory_movement(
        v_sale.company_id, v_item.product_id, 'return', v_item.quantity,
        'Anulación de venta ' || v_sale.sale_number, 'sale_void', v_sale.id
      );
    end if;
  end loop;

  return v_sale;
end;
$$;

grant execute on function void_sale to authenticated;
