-- bizko — Fase 7: catálogo público, carrito y pedidos
--
-- Esta fase introduce el primer acceso PÚBLICO (usuarios anónimos, sin
-- Supabase Auth) a la base de datos: el catálogo y el checkout. Por eso,
-- en vez de exponer políticas RLS públicas sobre las tablas completas
-- (que expondrían columnas sensibles como products.cost_cents por fila),
-- todo el acceso público pasa por funciones RPC SECURITY DEFINER que
-- seleccionan explícitamente solo columnas seguras. Nunca se agrega una
-- política RLS "select using (true)" sobre companies/products/services.

create type order_payment_status as enum ('pending', 'paid', 'canceled');

-- =========================================================================
-- companies: identidad pública del negocio
-- =========================================================================
alter table companies
  add column if not exists description text,
  add column if not exists business_hours text,
  add column if not exists orders_sequence integer not null default 0;

-- =========================================================================
-- orders / order_items
-- =========================================================================
alter table orders
  add column if not exists order_number text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists delivery_address text,
  add column if not exists delivery_city text,
  add column if not exists delivery_reference text,
  add column if not exists payment_status order_payment_status not null default 'pending',
  add column if not exists subtotal_cents integer not null default 0,
  add column if not exists delivery_fee_cents integer not null default 0,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists orders_company_order_number_idx on orders (company_id, order_number);
create index if not exists orders_company_status_idx on orders (company_id, status);
create index if not exists orders_company_created_idx on orders (company_id, created_at desc);

alter table order_items
  add column if not exists product_name text,
  add column if not exists unit product_unit,
  add column if not exists total_cents integer not null default 0;
update order_items set product_name = name where product_name is null;

-- =========================================================================
-- RPC públicas de solo lectura (rol anon): devuelven exclusivamente
-- columnas seguras para mostrar en /store/[slug].
-- =========================================================================
create function get_public_company(p_slug text)
returns table (
  id uuid, name text, slug text, business_type business_type,
  logo_url text, description text, phone text, city text, business_hours text
)
language sql
security definer
stable
set search_path = public
as $$
  select id, name, slug, business_type, logo_url, description, phone, city, business_hours
  from companies
  where slug = p_slug;
$$;

grant execute on function get_public_company to anon, authenticated;

create function list_public_categories(p_company_id uuid)
returns table (id uuid, name text)
language sql
security definer
stable
set search_path = public
as $$
  select id, name
  from product_categories
  where company_id = p_company_id and status = 'active'
  order by sort_order, name;
$$;

grant execute on function list_public_categories to anon, authenticated;

create function list_public_products(p_company_id uuid, p_category_id uuid default null)
returns table (
  id uuid, category_id uuid, name text, description text, image_url text,
  price_cents integer, unit product_unit, sku text,
  track_inventory boolean, current_stock numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select id, category_id, name, description, image_url, price_cents, unit, sku,
    track_inventory, current_stock
  from products
  where company_id = p_company_id
    and status = 'active'
    and is_published = true
    and (p_category_id is null or category_id = p_category_id)
  order by name;
$$;

grant execute on function list_public_products to anon, authenticated;

-- Confirmación de pedido: lookup directo por id (enlace no adivinable),
-- nunca un listado. No expone company_id de otros pedidos ni datos internos.
create function get_public_order(p_order_id uuid)
returns table (
  id uuid, order_number text, status order_status, fulfillment order_fulfillment,
  payment_method payment_method, payment_status order_payment_status,
  customer_name text, delivery_address text, delivery_city text, delivery_reference text,
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
    o.customer_name, o.delivery_address, o.delivery_city, o.delivery_reference,
    o.subtotal_cents, o.delivery_fee_cents, o.discount_cents, o.total_cents,
    o.notes, o.created_at, c.name, c.slug
  from orders o
  join companies c on c.id = o.company_id
  where o.id = p_order_id;
$$;

grant execute on function get_public_order to anon, authenticated;

create function list_public_order_items(p_order_id uuid)
returns table (id uuid, product_name text, quantity numeric, unit product_unit, unit_price_cents integer, total_cents integer)
language sql
security definer
stable
set search_path = public
as $$
  select id, product_name, quantity, unit, unit_price_cents, total_cents
  from order_items
  where order_id = p_order_id;
$$;

grant execute on function list_public_order_items to anon, authenticated;

-- =========================================================================
-- RPC: crear un pedido público (checkout). Único punto de escritura para
-- usuarios anónimos. Revalida disponibilidad y precios en el servidor —
-- nunca confía en montos calculados en el navegador.
-- =========================================================================
create function create_public_order(
  p_company_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_type order_fulfillment,
  p_delivery_address text,
  p_delivery_city text,
  p_delivery_reference text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_seq integer;
  v_customer_id uuid;
  v_order_id uuid;
  v_subtotal integer := 0;
  v_item jsonb;
  v_product products;
  v_quantity numeric;
begin
  select id into v_company_id from companies where slug = p_company_slug;
  if v_company_id is null then
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
  if p_delivery_type = 'delivery' and (p_delivery_address is null or trim(p_delivery_address) = '') then
    raise exception 'La dirección es obligatoria para domicilio.';
  end if;

  -- Primera pasada: revalidar cada producto (pertenece a esta empresa,
  -- está publicado, hay suficiente stock) y calcular el subtotal real.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = nullif(v_item ->> 'product_id', '')::uuid
        and company_id = v_company_id
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

  select id into v_customer_id from customers
    where company_id = v_company_id and phone = trim(p_customer_phone)
    limit 1;

  if v_customer_id is null then
    insert into customers (company_id, first_name, phone, email, address, city)
    values (
      v_company_id, trim(p_customer_name), trim(p_customer_phone),
      nullif(trim(p_customer_email), ''), p_delivery_address, p_delivery_city
    )
    returning id into v_customer_id;
  end if;

  update companies set orders_sequence = orders_sequence + 1
    where id = v_company_id
    returning orders_sequence into v_seq;

  insert into orders (
    company_id, customer_id, order_number, customer_name, customer_phone, customer_email,
    fulfillment, delivery_address, delivery_city, delivery_reference,
    payment_method, payment_status, subtotal_cents, delivery_fee_cents, discount_cents, total_cents,
    notes, status
  ) values (
    v_company_id, v_customer_id, 'P-' || lpad(v_seq::text, 6, '0'),
    trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''),
    p_delivery_type, p_delivery_address, p_delivery_city, nullif(trim(p_delivery_reference), ''),
    'cash_on_delivery', 'pending', v_subtotal, 0, 0, v_subtotal,
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

grant execute on function create_public_order to anon, authenticated;

-- =========================================================================
-- RPC: cambiar el estado de un pedido desde el panel administrativo.
-- Al marcar "Entregado" con pago confirmado, genera el ingreso de caja
-- (si hay una caja abierta) — nunca duplica el movimiento si ya existe.
-- =========================================================================
create function set_order_status(
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
