-- bizko — Fase 4: ventas
--
-- sales/sale_items ya existían desde 0001_init.sql con las columnas mínimas;
-- se completan aquí con subtotal/descuento/impuestos, número de venta legible
-- por empresa, estado (completada/anulada) y el tipo de cada línea (producto
-- o servicio). Se agrega create_sale() como RPC transaccional: calcula
-- totales, genera el número de venta de forma segura ante concurrencia y
-- crea la venta + sus líneas en una sola operación atómica.

create type sale_item_type as enum ('product', 'service');
create type sale_status as enum ('completed', 'voided');

-- Fix de un bug de la Fase 2: company_members.user_id y sales.user_id sólo
-- referenciaban auth.users, que PostgREST no puede "embeber" en un select
-- (select("*, profile:profiles(*)")) porque el esquema auth no se expone.
-- Se agrega una segunda FK hacia profiles(id) (mismo valor por diseño, ya
-- que profiles.id también referencia auth.users.id 1:1) para que el
-- embedding funcione tanto en el panel de equipo como en el listado de ventas.
alter table company_members
  add constraint company_members_user_id_profiles_fkey
  foreign key (user_id) references profiles (id);

alter table sales
  add constraint sales_user_id_profiles_fkey
  foreign key (user_id) references profiles (id);

-- Contador atómico por empresa para el número de venta legible (V-000001).
alter table companies
  add column if not exists sales_sequence integer not null default 0;

alter table sales
  add column if not exists sale_number text,
  add column if not exists subtotal_cents integer not null default 0,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists tax_cents integer not null default 0,
  add column if not exists status sale_status not null default 'completed',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists sales_company_sale_number_idx
  on sales (company_id, sale_number);
create index if not exists sales_company_created_idx
  on sales (company_id, created_at desc);
create index if not exists sales_company_status_idx
  on sales (company_id, status);

alter table sale_items
  add column if not exists item_type sale_item_type not null default 'product',
  add column if not exists discount_cents integer not null default 0,
  add column if not exists total_cents integer not null default 0;
alter table sale_items alter column item_type drop default;

create index if not exists sale_items_sale_id_idx on sale_items (sale_id);

-- =========================================================================
-- RPC: crear una venta completa (encabezado + líneas) en una sola
-- transacción atómica, con numeración segura ante ventas concurrentes.
-- =========================================================================
create function create_sale(
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

  insert into sale_items (
    sale_id, product_id, service_id, item_type, name, quantity,
    unit_price_cents, discount_cents, total_cents
  )
  select
    v_sale.id,
    nullif(item ->> 'product_id', '')::uuid,
    nullif(item ->> 'service_id', '')::uuid,
    (item ->> 'item_type')::sale_item_type,
    item ->> 'name',
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price_cents')::integer,
    coalesce((item ->> 'discount_cents')::integer, 0),
    round((item ->> 'unit_price_cents')::integer * (item ->> 'quantity')::numeric)::integer
      - coalesce((item ->> 'discount_cents')::integer, 0)
  from jsonb_array_elements(p_items) as item;

  return v_sale;
end;
$$;

grant execute on function create_sale to authenticated;
