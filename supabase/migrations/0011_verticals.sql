-- bizko — Fase 9: módulos específicos por tipo de negocio
--
-- CORE + VERTICAL: estas tablas nunca duplican clientes/productos/ventas/
-- inventario/pedidos/caja — solo agregan lo que cada tipo de negocio
-- necesita encima, reutilizando siempre las entidades del CORE (customers,
-- products, services, sales, orders...). RLS sigue el mismo patrón de
-- is_company_member(company_id) usado desde la Fase 3.

-- =========================================================================
-- BOUTIQUE: variantes de producto (prioritario, ver AGENTS de la fase)
-- =========================================================================
alter table products
  add column if not exists has_variants boolean not null default false;

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  sku text,
  price_cents integer not null default 0,
  cost_cents integer not null default 0,
  stock numeric not null default 0,
  image_url text,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_company_id_idx on product_variants (company_id);
create index product_variants_product_id_idx on product_variants (product_id);

-- Atributos libres por variante (talla, color, material...), no limitado a
-- un esquema fijo — ver Fase 9 §12.
create table variant_attributes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants (id) on delete cascade,
  attribute_name text not null,
  attribute_value text not null
);
create index variant_attributes_variant_id_idx on variant_attributes (variant_id);

alter table sale_items add column if not exists variant_id uuid references product_variants (id) on delete set null;
alter table order_items add column if not exists variant_id uuid references product_variants (id) on delete set null;

alter table product_variants enable row level security;
alter table variant_attributes enable row level security;

create policy "product_variants_all_own_company" on product_variants for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "variant_attributes_all_own_company" on variant_attributes for all
  using (exists (select 1 from product_variants v where v.id = variant_id and is_company_member(v.company_id)))
  with check (exists (select 1 from product_variants v where v.id = variant_id and is_company_member(v.company_id)));

-- Público: catálogo de variantes de un producto publicado (nunca cost_cents).
create function list_public_variants(p_product_id uuid)
returns table (id uuid, sku text, price_cents integer, stock numeric, image_url text)
language sql
security definer
stable
set search_path = public
as $$
  select v.id, v.sku, v.price_cents, v.stock, v.image_url
  from product_variants v
  join products p on p.id = v.product_id
  where v.product_id = p_product_id and v.status = 'active'
    and p.status = 'active' and p.is_published = true;
$$;

grant execute on function list_public_variants to anon, authenticated;

create function list_public_variant_attributes(p_product_id uuid)
returns table (variant_id uuid, attribute_name text, attribute_value text)
language sql
security definer
stable
set search_path = public
as $$
  select a.variant_id, a.attribute_name, a.attribute_value
  from variant_attributes a
  join product_variants v on v.id = a.variant_id
  join products p on p.id = v.product_id
  where v.product_id = p_product_id and v.status = 'active'
    and p.status = 'active' and p.is_published = true;
$$;

grant execute on function list_public_variant_attributes to anon, authenticated;

-- create_sale(): se reemplaza para descontar la variante correcta cuando el
-- item la especifica, en vez del stock general del producto.
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
  v_variant_id uuid;
  v_track_inventory boolean;
  v_open_register_id uuid;
  v_variant_stock numeric;
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
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;

    insert into sale_items (
      sale_id, product_id, service_id, variant_id, item_type, name, quantity,
      unit_price_cents, discount_cents, total_cents
    ) values (
      v_sale.id,
      v_product_id,
      nullif(v_item ->> 'service_id', '')::uuid,
      v_variant_id,
      (v_item ->> 'item_type')::sale_item_type,
      v_item ->> 'name',
      v_quantity,
      v_unit_price,
      v_item_discount,
      v_item_total
    );

    if v_variant_id is not null then
      select stock into v_variant_stock from product_variants where id = v_variant_id and company_id = p_company_id for update;
      if v_variant_stock is null then
        raise exception 'Variante no encontrada.';
      end if;
      if v_variant_stock - v_quantity < 0 then
        raise exception 'No hay suficiente inventario disponible para esta variante.';
      end if;
      update product_variants set stock = stock - v_quantity, updated_at = now() where id = v_variant_id;
    elsif v_product_id is not null then
      select track_inventory into v_track_inventory from products where id = v_product_id;
      if v_track_inventory then
        perform apply_inventory_movement(
          p_company_id, v_product_id, 'out', v_quantity,
          'Venta ' || v_sale.sale_number, 'sale', v_sale.id
        );
      end if;
    end if;
  end loop;

  if p_payment_method != 'cash_on_delivery' then
    select id into v_open_register_id from cash_registers
      where company_id = p_company_id and status = 'open';
    if v_open_register_id is not null then
      perform create_cash_movement(
        p_company_id, v_open_register_id, 'income', v_sale.total_cents, p_payment_method,
        'sale', v_sale.id, 'Venta ' || v_sale.sale_number
      );
    end if;
  end if;

  return v_sale;
end;
$$;

-- list_public_products(): se agrega has_variants para que el catálogo sepa
-- cuándo mostrar el selector de talla/color antes de agregar al carrito.
drop function if exists list_public_products(uuid, uuid);
create function list_public_products(p_company_id uuid, p_category_id uuid default null)
returns table (
  id uuid, category_id uuid, name text, description text, image_url text,
  price_cents integer, unit product_unit, sku text,
  track_inventory boolean, current_stock numeric, has_variants boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select id, category_id, name, description, image_url, price_cents, unit, sku,
    track_inventory, current_stock, has_variants
  from products
  where company_id = p_company_id
    and status = 'active'
    and is_published = true
    and (p_category_id is null or category_id = p_category_id)
  order by name;
$$;

grant execute on function list_public_products to anon, authenticated;

-- create_public_order(): se reemplaza para soportar variante por línea
-- (boutique) — valida y descuenta el stock de la variante, no del producto.
create or replace function create_public_order(
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
  v_variant product_variants;
  v_variant_id uuid;
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

    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    if v_product.has_variants then
      if v_variant_id is null then
        raise exception '% requiere seleccionar una variante.', v_product.name;
      end if;
      select * into v_variant from product_variants
        where id = v_variant_id and product_id = v_product.id and status = 'active'
        for update;
      if v_variant.id is null then
        raise exception 'Esa variante ya no está disponible.';
      end if;
      if v_quantity > v_variant.stock then
        raise exception 'Solo quedan % disponibles de %.', v_variant.stock, v_product.name;
      end if;
      v_subtotal := v_subtotal + round(v_variant.price_cents * v_quantity)::integer;
    else
      if v_product.track_inventory and v_quantity > v_product.current_stock then
        raise exception 'Solo quedan % % disponibles de %.', v_product.current_stock, v_product.unit, v_product.name;
      end if;
      v_subtotal := v_subtotal + round(v_product.price_cents * v_quantity)::integer;
    end if;
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
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;

    if v_variant_id is not null then
      select * into v_variant from product_variants where id = v_variant_id;
      insert into order_items (order_id, product_id, variant_id, product_name, quantity, unit, unit_price_cents, total_cents)
      select
        v_order_id, v_product.id, v_variant.id,
        v_product.name || coalesce(
          ' (' || (select string_agg(attribute_value, ', ' order by attribute_name) from variant_attributes where variant_id = v_variant.id) || ')',
          ''
        ),
        v_quantity, v_product.unit,
        v_variant.price_cents, round(v_variant.price_cents * v_quantity)::integer;
      update product_variants set stock = stock - v_quantity, updated_at = now() where id = v_variant_id;
    else
      insert into order_items (order_id, product_id, product_name, quantity, unit, unit_price_cents, total_cents)
      values (
        v_order_id, v_product.id, v_product.name, v_quantity, v_product.unit,
        v_product.price_cents, round(v_product.price_cents * v_quantity)::integer
      );
    end if;
  end loop;

  return v_order_id;
end;
$$;

-- =========================================================================
-- LAVADO DE MOTOS + TALLER: vehículos del cliente (tabla compartida)
-- =========================================================================
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  plate text not null,
  brand text,
  model text,
  color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_company_id_idx on vehicles (company_id);
create index vehicles_customer_id_idx on vehicles (customer_id);

alter table vehicles enable row level security;
create policy "vehicles_all_own_company" on vehicles for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- =========================================================================
-- BARBERÍA: agenda / citas
-- =========================================================================
create type appointment_status as enum ('pending', 'confirmed', 'completed', 'canceled', 'no_show');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  service_id uuid references services (id) on delete set null,
  employee_id uuid references auth.users (id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time,
  status appointment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_company_date_idx on appointments (company_id, appointment_date);

alter table appointments
  add constraint appointments_employee_id_profiles_fkey
  foreign key (employee_id) references profiles (id);

alter table appointments enable row level security;
create policy "appointments_all_own_company" on appointments for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- =========================================================================
-- LAVANDERÍA: órdenes de lavado
-- =========================================================================
create type laundry_order_status as enum ('received', 'in_process', 'ready', 'delivered', 'canceled');

alter table companies add column if not exists laundry_sequence integer not null default 0;

create table laundry_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  order_number text not null,
  received_at timestamptz not null default now(),
  estimated_ready_at timestamptz,
  delivered_at timestamptz,
  status laundry_order_status not null default 'received',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index laundry_orders_company_number_idx on laundry_orders (company_id, order_number);

create table laundry_order_items (
  id uuid primary key default gen_random_uuid(),
  laundry_order_id uuid not null references laundry_orders (id) on delete cascade,
  service_id uuid references services (id) on delete set null,
  description text not null,
  quantity numeric not null default 1
);

alter table laundry_orders enable row level security;
alter table laundry_order_items enable row level security;
create policy "laundry_orders_all_own_company" on laundry_orders for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));
create policy "laundry_order_items_all_own_company" on laundry_order_items for all
  using (exists (select 1 from laundry_orders lo where lo.id = laundry_order_id and is_company_member(lo.company_id)))
  with check (exists (select 1 from laundry_orders lo where lo.id = laundry_order_id and is_company_member(lo.company_id)));

create function create_laundry_order(
  p_company_id uuid,
  p_customer_id uuid,
  p_estimated_ready_at timestamptz,
  p_notes text,
  p_items jsonb
)
returns laundry_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order laundry_orders;
  v_seq integer;
  v_item jsonb;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  update companies set laundry_sequence = laundry_sequence + 1
    where id = p_company_id
    returning laundry_sequence into v_seq;

  insert into laundry_orders (company_id, customer_id, order_number, estimated_ready_at, notes)
  values (p_company_id, p_customer_id, 'L-' || lpad(v_seq::text, 6, '0'), p_estimated_ready_at, nullif(trim(p_notes), ''))
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into laundry_order_items (laundry_order_id, service_id, description, quantity)
    values (
      v_order.id,
      nullif(v_item ->> 'service_id', '')::uuid,
      v_item ->> 'description',
      coalesce((v_item ->> 'quantity')::numeric, 1)
    );
  end loop;

  return v_order;
end;
$$;

grant execute on function create_laundry_order to authenticated;

-- =========================================================================
-- MASCOTAS
-- =========================================================================
create table pets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  name text not null,
  species text,
  breed text,
  sex text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pets_company_id_idx on pets (company_id);
create index pets_customer_id_idx on pets (customer_id);

alter table pets enable row level security;
create policy "pets_all_own_company" on pets for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- =========================================================================
-- TALLER: órdenes de trabajo (reutiliza vehicles)
-- =========================================================================
create type work_order_status as enum (
  'received', 'diagnosis', 'in_repair', 'waiting_parts', 'ready', 'delivered', 'canceled'
);

alter table companies add column if not exists work_order_sequence integer not null default 0;

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  vehicle_id uuid references vehicles (id) on delete set null,
  order_number text not null,
  description text,
  diagnosis text,
  status work_order_status not null default 'received',
  estimated_total_cents integer,
  final_total_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index work_orders_company_number_idx on work_orders (company_id, order_number);

alter table work_orders enable row level security;
create policy "work_orders_all_own_company" on work_orders for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create function create_work_order(
  p_company_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_description text,
  p_estimated_total_cents integer
)
returns work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order work_orders;
  v_seq integer;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  update companies set work_order_sequence = work_order_sequence + 1
    where id = p_company_id
    returning work_order_sequence into v_seq;

  insert into work_orders (company_id, customer_id, vehicle_id, order_number, description, estimated_total_cents)
  values (p_company_id, p_customer_id, p_vehicle_id, 'T-' || lpad(v_seq::text, 6, '0'), nullif(trim(p_description), ''), p_estimated_total_cents)
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function create_work_order to authenticated;

-- =========================================================================
-- PANADERÍA: recetas (producción simple)
-- =========================================================================
create table recipes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_company_id_idx on recipes (company_id);

create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  ingredient_name text not null,
  quantity numeric not null,
  unit product_unit not null default 'unidad'
);

-- Producción → consumo de ingredientes → inventario: se deja preparada la
-- estructura (Fase 9 §3), sin UI todavía.
create table production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  quantity_produced numeric not null,
  produced_at timestamptz not null default now(),
  user_id uuid references auth.users (id),
  notes text
);

alter table recipes enable row level security;
alter table recipe_items enable row level security;
alter table production_orders enable row level security;

create policy "recipes_all_own_company" on recipes for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));
create policy "recipe_items_all_own_company" on recipe_items for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_company_member(r.company_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_company_member(r.company_id)));
create policy "production_orders_all_own_company" on production_orders for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- =========================================================================
-- COMIDA PREPARADA: configuración de menú sobre products existentes
-- =========================================================================
alter table products
  add column if not exists prep_time_minutes integer,
  add column if not exists is_featured boolean not null default false,
  add column if not exists available_from time,
  add column if not exists available_until time;
