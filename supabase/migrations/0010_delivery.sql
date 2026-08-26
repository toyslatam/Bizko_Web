-- bizko — Fase 8: delivery, zonas de entrega y logística
--
-- Separa dos conceptos que hasta ahora vivían mezclados: el ESTADO DEL
-- PEDIDO (pending/confirmed/preparing/ready/delivered/canceled, ya existía)
-- y el ESTADO DEL DELIVERY (asignación de repartidor, recogido, en camino,
-- entregado, fallido) — solo aplica a pedidos con fulfillment='delivery'.
-- Para pedidos "recoger en tienda", delivery_status siempre es
-- 'not_applicable' y el flujo de pago sigue igual que en la Fase 7
-- (al marcar el pedido como entregado). Para pedidos a domicilio, el
-- flujo de pago contra entrega se dispara cuando delivery_status llega
-- a 'delivered' (ver set_delivery_status más abajo), momento en el que
-- también se sincroniza orders.status a 'delivered'.

-- delivery_orders (Fase 1) nunca se usó y queda reemplazada por
-- delivery_status/delivery_driver_id en orders + la tabla delivery_drivers.
drop table if exists delivery_orders;

create type delivery_driver_status as enum ('available', 'busy', 'inactive');
create type delivery_status_type as enum (
  'not_applicable', 'pending_assignment', 'assigned', 'picked_up',
  'on_the_way', 'delivered', 'failed'
);

-- =========================================================================
-- companies: activar/desactivar delivery y recoger en tienda
-- =========================================================================
alter table companies
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists pickup_enabled boolean not null default true;

-- =========================================================================
-- delivery_zones / delivery_areas (barrios de una zona)
-- =========================================================================
create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  description text,
  delivery_fee_cents integer not null default 0,
  minimum_order_cents integer not null default 0,
  estimated_time text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index delivery_zones_company_id_idx on delivery_zones (company_id);

create table delivery_areas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  delivery_zone_id uuid not null references delivery_zones (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index delivery_areas_company_id_idx on delivery_areas (company_id);
create index delivery_areas_zone_id_idx on delivery_areas (delivery_zone_id);

-- =========================================================================
-- delivery_drivers (repartidores)
-- =========================================================================
create table delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  phone text not null,
  status delivery_driver_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index delivery_drivers_company_id_idx on delivery_drivers (company_id);

-- =========================================================================
-- customer_addresses: direcciones guardadas del cliente (reutilizables)
-- =========================================================================
alter table customer_addresses
  add column if not exists company_id uuid references companies (id) on delete cascade,
  add column if not exists neighborhood text,
  add column if not exists reference text,
  add column if not exists is_default boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update customer_addresses ca
  set company_id = c.company_id
  from customers c
  where ca.customer_id = c.id and ca.company_id is null;
alter table customer_addresses alter column company_id set not null;

update customer_addresses set reference = notes where reference is null;
alter table customer_addresses drop column notes;
create index customer_addresses_company_id_idx on customer_addresses (company_id);

-- =========================================================================
-- orders: todo lo específico de delivery, guardado como snapshot histórico
-- =========================================================================
alter table orders
  add column if not exists delivery_zone_id uuid references delivery_zones (id) on delete set null,
  add column if not exists delivery_address_id uuid references customer_addresses (id) on delete set null,
  add column if not exists delivery_neighborhood text,
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists estimated_delivery_time text,
  add column if not exists delivery_driver_id uuid references delivery_drivers (id) on delete set null,
  add column if not exists delivery_status delivery_status_type not null default 'not_applicable',
  add column if not exists delivery_failure_reason text,
  add column if not exists scheduled_delivery_date date,
  add column if not exists scheduled_delivery_time text;

create index orders_delivery_status_idx on orders (company_id, delivery_status);
create index orders_delivery_driver_idx on orders (delivery_driver_id);

-- Pedidos ya existentes: reflejar en delivery_status lo que ya son.
update orders set delivery_status = 'not_applicable' where fulfillment = 'pickup';
update orders set delivery_status = (case
    when status = 'delivered' then 'delivered'
    when status = 'canceled' then 'failed'
    else 'pending_assignment'
  end)::delivery_status_type
  where fulfillment = 'delivery' and delivery_status = 'not_applicable';

-- =========================================================================
-- RLS de las tablas nuevas — mismo patrón que el resto de la Fase 3-6.
-- =========================================================================
alter table delivery_zones enable row level security;
alter table delivery_areas enable row level security;
alter table delivery_drivers enable row level security;

create policy "delivery_zones_all_own_company" on delivery_zones for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "delivery_areas_all_own_company" on delivery_areas for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "delivery_drivers_all_own_company" on delivery_drivers for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- =========================================================================
-- RPC pública: zonas/barrios activos, para el selector del checkout.
-- Nunca expone company_id de otra empresa ni información administrativa.
-- =========================================================================
create function list_public_delivery_areas(p_company_id uuid)
returns table (
  id uuid, name text, delivery_zone_id uuid, zone_name text,
  delivery_fee_cents integer, minimum_order_cents integer, estimated_time text
)
language sql
security definer
stable
set search_path = public
as $$
  select a.id, a.name, z.id, z.name, z.delivery_fee_cents, z.minimum_order_cents, z.estimated_time
  from delivery_areas a
  join delivery_zones z on z.id = a.delivery_zone_id
  where a.company_id = p_company_id and z.is_active = true
  order by z.name, a.name;
$$;

grant execute on function list_public_delivery_areas to anon, authenticated;

-- get_public_company(): se agrega delivery_enabled/pickup_enabled para que
-- el catálogo sepa qué opciones de entrega ofrecer. CREATE OR REPLACE no
-- permite cambiar la lista de columnas de un RETURNS TABLE, así que se
-- elimina primero.
drop function if exists get_public_company(text);
create function get_public_company(p_slug text)
returns table (
  id uuid, name text, slug text, business_type business_type,
  logo_url text, description text, phone text, city text, business_hours text,
  delivery_enabled boolean, pickup_enabled boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select id, name, slug, business_type, logo_url, description, phone, city, business_hours,
    delivery_enabled, pickup_enabled
  from companies
  where slug = p_slug;
$$;

-- =========================================================================
-- create_public_order(): se reemplaza para resolver la zona (si aplica),
-- validar el pedido mínimo en el servidor y calcular el costo de entrega.
-- Cambia la firma de parámetros, así que se elimina la versión de la
-- Fase 7 explícitamente (si no, quedaría como un overload separado).
-- =========================================================================
drop function if exists create_public_order(
  text, text, text, text, order_fulfillment, text, text, text, text, jsonb
);
create function create_public_order(
  p_company_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_type order_fulfillment,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_neighborhood text,
  p_delivery_reference text,
  p_delivery_area_id uuid,
  p_recipient_name text,
  p_recipient_phone text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
  v_seq integer;
  v_customer_id uuid;
  v_order_id uuid;
  v_subtotal integer := 0;
  v_item jsonb;
  v_product products;
  v_quantity numeric;
  v_zone delivery_zones;
  v_delivery_fee integer := 0;
  v_delivery_status delivery_status_type := 'not_applicable';
begin
  select * into v_company from companies where slug = p_company_slug;
  if v_company.id is null then
    raise exception 'Negocio no encontrado.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu pedido debe tener al menos un producto.';
  end if;
  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if p_customer_phone is null or trim(p_customer_phone) = '' then
    raise exception 'El teléfono es obligatorio.';
  end if;

  if p_delivery_type = 'delivery' then
    if not v_company.delivery_enabled then
      raise exception 'Este negocio no tiene entrega a domicilio disponible.';
    end if;
    if p_delivery_address is null or trim(p_delivery_address) = '' then
      raise exception 'La dirección es obligatoria para domicilio.';
    end if;
    if p_delivery_area_id is not null then
      select z.* into v_zone
        from delivery_zones z
        join delivery_areas a on a.delivery_zone_id = z.id
        where a.id = p_delivery_area_id and z.company_id = v_company.id and z.is_active = true;
      if v_zone.id is null then
        raise exception 'Esa zona de entrega ya no está disponible.';
      end if;
      v_delivery_fee := v_zone.delivery_fee_cents;
    end if;
    v_delivery_status := 'pending_assignment';
  else
    if not v_company.pickup_enabled then
      raise exception 'Este negocio no tiene recoger en tienda disponible.';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = nullif(v_item ->> 'product_id', '')::uuid
        and company_id = v_company.id
        and status = 'active'
        and is_published = true
      for update;

    if v_product.id is null then
      raise exception 'Uno de los productos ya no está disponible.';
    end if;

    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida para %.', v_product.name;
    end if;
    if v_product.track_inventory and v_quantity > v_product.current_stock then
      raise exception 'Solo quedan % % disponibles de %.', v_product.current_stock, v_product.unit, v_product.name;
    end if;

    v_subtotal := v_subtotal + round(v_product.price_cents * v_quantity)::integer;
  end loop;

  if v_zone.id is not null and v_subtotal < v_zone.minimum_order_cents then
    raise exception 'El pedido mínimo para esta zona es de %.', to_char(v_zone.minimum_order_cents / 100.0, 'FM999G999G999D00');
  end if;

  select id into v_customer_id from customers
    where company_id = v_company.id and phone = trim(p_customer_phone)
    limit 1;

  if v_customer_id is null then
    insert into customers (company_id, first_name, phone, email, address, city)
    values (
      v_company.id, trim(p_customer_name), trim(p_customer_phone),
      nullif(trim(p_customer_email), ''), p_delivery_address, p_delivery_city
    )
    returning id into v_customer_id;
  end if;

  update companies set orders_sequence = orders_sequence + 1
    where id = v_company.id
    returning orders_sequence into v_seq;

  insert into orders (
    company_id, customer_id, order_number, customer_name, customer_phone, customer_email,
    fulfillment, delivery_address, delivery_city, delivery_neighborhood, delivery_reference,
    delivery_zone_id, recipient_name, recipient_phone, estimated_delivery_time, delivery_status,
    payment_method, payment_status, subtotal_cents, delivery_fee_cents, discount_cents, total_cents,
    notes, status
  ) values (
    v_company.id, v_customer_id, 'P-' || lpad(v_seq::text, 6, '0'),
    trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''),
    p_delivery_type, p_delivery_address, p_delivery_city, nullif(trim(p_delivery_neighborhood), ''),
    nullif(trim(p_delivery_reference), ''),
    v_zone.id,
    coalesce(nullif(trim(p_recipient_name), ''), trim(p_customer_name)),
    coalesce(nullif(trim(p_recipient_phone), ''), trim(p_customer_phone)),
    v_zone.estimated_time, v_delivery_status,
    'cash_on_delivery', 'pending', v_subtotal, v_delivery_fee, 0, v_subtotal + v_delivery_fee,
    nullif(trim(p_notes), ''), 'pending'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    insert into order_items (order_id, product_id, product_name, quantity, unit, unit_price_cents, total_cents)
    values (
      v_order_id, v_product.id, v_product.name, v_quantity, v_product.unit,
      v_product.price_cents, round(v_product.price_cents * v_quantity)::integer
    );
  end loop;

  return v_order_id;
end;
$$;

-- get_public_order(): se agregan los campos de delivery para la
-- confirmación del pedido en /store/[slug]/pedido/[orderId]. Mismo caso
-- que get_public_company: hay que eliminarla antes de cambiar sus columnas.
drop function if exists get_public_order(uuid);
create function get_public_order(p_order_id uuid)
returns table (
  id uuid, order_number text, status order_status, fulfillment order_fulfillment,
  payment_method payment_method, payment_status order_payment_status,
  customer_name text, delivery_address text, delivery_city text, delivery_neighborhood text,
  delivery_reference text, estimated_delivery_time text, delivery_status delivery_status_type,
  subtotal_cents integer, delivery_fee_cents integer, discount_cents integer, total_cents integer,
  notes text, created_at timestamptz, company_name text, company_slug text
)
language sql
security definer
stable
set search_path = public
as $$
  select o.id, o.order_number, o.status, o.fulfillment,
    o.payment_method, o.payment_status,
    o.customer_name, o.delivery_address, o.delivery_city, o.delivery_neighborhood,
    o.delivery_reference, o.estimated_delivery_time, o.delivery_status,
    o.subtotal_cents, o.delivery_fee_cents, o.discount_cents, o.total_cents,
    o.notes, o.created_at, c.name, c.slug
  from orders o
  join companies c on c.id = o.company_id
  where o.id = p_order_id;
$$;

-- =========================================================================
-- RPC: cambiar el estado del DELIVERY (independiente del estado del
-- pedido). Al llegar a 'delivered', sincroniza orders.status y dispara
-- el mismo flujo de pago contra entrega que set_order_status.
-- =========================================================================
create function set_delivery_status(
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
      end if;
    end if;
  end if;

  return v_order;
end;
$$;

grant execute on function set_delivery_status to authenticated;

-- =========================================================================
-- RPC: asignar/cambiar el repartidor de un pedido de entrega.
-- =========================================================================
create function assign_delivery_driver(p_order_id uuid, p_driver_id uuid)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido no encontrado.';
  end if;
  if not is_company_member(v_order.company_id) then
    raise exception 'No tienes permiso para gestionar este pedido.';
  end if;
  if p_driver_id is not null and not exists (
    select 1 from delivery_drivers where id = p_driver_id and company_id = v_order.company_id
  ) then
    raise exception 'Repartidor no encontrado.';
  end if;

  update orders set
    delivery_driver_id = p_driver_id,
    delivery_status = (case when p_driver_id is not null and delivery_status = 'pending_assignment' then 'assigned' else delivery_status end)::delivery_status_type,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function assign_delivery_driver to authenticated;
