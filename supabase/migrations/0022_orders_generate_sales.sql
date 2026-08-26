-- =============================================================================
-- Unifica Pedidos y Ventas cuando un pedido del catálogo se completa
-- (entregado + pago confirmado), sin fusionar las tablas: Pedido sigue
-- siendo la orden de compra y su seguimiento; Venta sigue siendo la
-- operación comercial cerrada — un pedido completado ahora GENERA su propia
-- venta, relacionada por `sales.order_id`.
--
-- Nada de esto duplica caja ni inventario:
--   - El movimiento de caja del pedido ya se crea en set_order_status()/
--     set_delivery_status() (Fase 8) — create_sale_from_order() NO llama
--     create_cash_movement().
--   - El descuento de inventario del pedido ya ocurre al CREARSE el pedido,
--     dentro de create_public_order() (corregido en 0021) — create_sale_from
--     _order() NO llama apply_inventory_movement() ni toca products/
--     product_variants.
-- Esta función solo registra la operación comercial (sales + sale_items)
-- para que el pedido aparezca en Ventas/Reportes, enlazada al pedido de
-- origen.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. sales: origen (POS/CATÁLOGO) + pedido de origen. Un mismo pedido nunca
-- puede generar más de una venta — el índice único lo garantiza a nivel de
-- base de datos, no solo en la lógica de la función.
-- ---------------------------------------------------------------------------
create type sale_source as enum ('pos', 'catalog');

alter table sales add column if not exists source sale_source not null default 'pos';
alter table sales add column if not exists order_id uuid references orders (id) on delete set null;

create unique index if not exists sales_order_id_unique_idx on sales (order_id) where order_id is not null;

-- ---------------------------------------------------------------------------
-- 2. create_sale_from_order(): registra la venta de un pedido ya entregado y
-- pagado. Idempotente — si el pedido ya tiene una venta, no crea otra.
-- ---------------------------------------------------------------------------
create function create_sale_from_order(p_order_id uuid)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_existing_sale sales;
  v_seq integer;
  v_sale sales;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Pedido no encontrado.';
  end if;

  if v_order.status != 'delivered' or v_order.payment_status != 'paid' then
    raise exception 'El pedido debe estar entregado y pagado para generar una venta.';
  end if;

  select * into v_existing_sale from sales where order_id = p_order_id;
  if v_existing_sale.id is not null then
    return v_existing_sale;
  end if;

  update companies set sales_sequence = sales_sequence + 1
    where id = v_order.company_id
    returning sales_sequence into v_seq;

  insert into sales (
    company_id, customer_id, user_id, sale_number,
    subtotal_cents, discount_cents, tax_cents, total_cents,
    payment_method, status, notes, source, order_id
  ) values (
    v_order.company_id, v_order.customer_id, auth.uid(), 'V-' || lpad(v_seq::text, 6, '0'),
    v_order.subtotal_cents, v_order.discount_cents, 0, v_order.total_cents,
    v_order.payment_method, 'completed',
    'Generada automáticamente del pedido ' || v_order.order_number,
    'catalog', v_order.id
  )
  returning * into v_sale;

  insert into sale_items (
    sale_id, product_id, service_id, variant_id, item_type, name, quantity,
    unit_price_cents, discount_cents, total_cents
  )
  select
    v_sale.id, oi.product_id, oi.service_id, oi.variant_id,
    (case when oi.service_id is not null then 'service' else 'product' end)::sale_item_type,
    oi.product_name, oi.quantity, oi.unit_price_cents, 0, oi.total_cents
  from order_items oi
  where oi.order_id = p_order_id;

  return v_sale;
end;
$$;

-- Sin grant a authenticated: solo la invocan set_order_status()/
-- set_delivery_status() (mismo esquema de seguridad que apply_inventory_
-- movement/create_cash_movement, funciones internas llamadas por perform,
-- nunca directo desde el cliente).

-- ---------------------------------------------------------------------------
-- 3. set_order_status(): agrega la generación de venta en el mismo punto
-- donde ya se crea el movimiento de caja (pedidos de recoger en tienda).
-- Mismo cuerpo que la Fase 7, con esa única adición.
-- ---------------------------------------------------------------------------
create or replace function set_order_status(
  p_order_id uuid,
  p_status order_status,
  p_payment_received boolean default false
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_is_member boolean;
  v_open_register_id uuid;
  v_already_has_movement boolean;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Pedido no encontrado.';
  end if;

  select is_company_member(v_order.company_id) into v_is_member;
  if not v_is_member then
    raise exception 'No tienes permiso para gestionar este pedido.';
  end if;

  update orders set status = p_status, updated_at = now()
    where id = p_order_id
    returning * into v_order;

  if p_status = 'delivered' and p_payment_received then
    update orders set payment_status = 'paid', updated_at = now()
      where id = p_order_id
      returning * into v_order;

    select exists(
      select 1 from cash_movements
      where reference_type = 'order' and reference_id = p_order_id and movement_type = 'income'
    ) into v_already_has_movement;

    if not v_already_has_movement then
      select id into v_open_register_id from cash_registers
        where company_id = v_order.company_id and status = 'open';
      if v_open_register_id is not null then
        perform create_cash_movement(
          v_order.company_id, v_open_register_id, 'income', v_order.total_cents, 'cash',
          'order', v_order.id, 'Pedido ' || v_order.order_number
        );
      end if;
      perform create_sale_from_order(v_order.id);
    end if;
  end if;

  if p_status = 'canceled' and v_order.payment_status = 'pending' then
    update orders set payment_status = 'canceled', updated_at = now()
      where id = p_order_id
      returning * into v_order;
  end if;

  return v_order;
end;
$$;

grant execute on function set_order_status to authenticated;

-- ---------------------------------------------------------------------------
-- 4. set_delivery_status(): mismo agregado, en el punto equivalente para
-- pedidos de entrega a domicilio. Mismo cuerpo que la Fase 8.
-- ---------------------------------------------------------------------------
create or replace function set_delivery_status(
  p_order_id uuid,
  p_status delivery_status_type,
  p_failure_reason text default null,
  p_payment_received boolean default false
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_is_member boolean;
  v_open_register_id uuid;
  v_already_has_movement boolean;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.fulfillment != 'delivery' then
    raise exception 'Este pedido no es de entrega a domicilio.';
  end if;

  select is_company_member(v_order.company_id) into v_is_member;
  if not v_is_member then
    raise exception 'No tienes permiso para gestionar este pedido.';
  end if;

  update orders set
    delivery_status = p_status,
    delivery_failure_reason = case when p_status = 'failed' then nullif(trim(p_failure_reason), '') else delivery_failure_reason end,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  if p_status = 'delivered' then
    update orders set status = 'delivered', updated_at = now()
      where id = p_order_id
      returning * into v_order;

    if p_payment_received then
      update orders set payment_status = 'paid', updated_at = now()
        where id = p_order_id
        returning * into v_order;

      select exists(
        select 1 from cash_movements
        where reference_type = 'order' and reference_id = p_order_id and movement_type = 'income'
      ) into v_already_has_movement;

      if not v_already_has_movement then
        select id into v_open_register_id from cash_registers
          where company_id = v_order.company_id and status = 'open';
        if v_open_register_id is not null then
          perform create_cash_movement(
            v_order.company_id, v_open_register_id, 'income', v_order.total_cents, 'cash',
            'order', v_order.id, 'Pedido ' || v_order.order_number
          );
        end if;
        perform create_sale_from_order(v_order.id);
      end if;
    end if;
  end if;

  return v_order;
end;
$$;

grant execute on function set_delivery_status to authenticated;
