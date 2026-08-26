-- =============================================================================
-- FASE — Vertical de restaurantes y comida rápida
--
-- Reutiliza el tipo de negocio "food" (Comida preparada, Fase 9) como
-- paraguas para restaurante/comida rápida/cafetería/pizzería/hamburguesería/
-- panadería-cafetería — todas necesitan exactamente el mismo set de
-- funcionalidades (menú con modificadores, mesas, cocina), así que no se
-- agregan tipos de negocio nuevos que duplicarían el mismo módulo varias
-- veces (spec: "no duplicar"). El negocio describe su rubro específico en su
-- nombre/descripción.
--
-- Todo lo demás reutiliza el CORE sin duplicar: clientes, productos,
-- categorías, pedidos, ventas, caja, inventario, delivery, reportes. Esta
-- migración solo AGREGA lo que es exclusivo de comida: modificadores,
-- combos, mesas, y las columnas mínimas para que pedidos/ventas/inventario
-- ya existentes sepan de dónde vino cada línea.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Diferenciar productos para venta vs. insumos (Fase §23) — un insumo no
-- aparece en el menú público, pero sí se controla en Inventario.
-- ---------------------------------------------------------------------------
alter table products add column if not exists is_ingredient boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Modificadores (Fase §4 — "crítico para restaurantes"). Por producto,
-- no una librería global reutilizable entre productos — más simple y
-- suficiente para esta fase; se puede generalizar después sin romper nada.
-- ---------------------------------------------------------------------------
create type modifier_selection_type as enum ('single', 'multiple');

create table modifier_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  name text not null,
  selection_type modifier_selection_type not null default 'single',
  is_required boolean not null default false,
  min_selections integer not null default 0,
  -- null = sin límite de selecciones.
  max_selections integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index modifier_groups_product_id_idx on modifier_groups (product_id);
create index modifier_groups_company_id_idx on modifier_groups (company_id);

create table modifier_options (
  id uuid primary key default gen_random_uuid(),
  modifier_group_id uuid not null references modifier_groups (id) on delete cascade,
  name text not null,
  price_cents integer not null default 0,
  sort_order integer not null default 0
);
create index modifier_options_group_id_idx on modifier_options (modifier_group_id);

alter table modifier_groups enable row level security;
alter table modifier_options enable row level security;

create policy "modifier_groups_all_own_company" on modifier_groups for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

create policy "modifier_options_all_own_company" on modifier_options for all
  using (exists (select 1 from modifier_groups g where g.id = modifier_group_id and is_company_member(g.company_id)))
  with check (exists (select 1 from modifier_groups g where g.id = modifier_group_id and is_company_member(g.company_id)));

-- Público: modificadores de un producto publicado (para el menú online).
create function list_public_modifier_groups(p_product_id uuid)
returns table (
  id uuid, name text, selection_type modifier_selection_type,
  is_required boolean, min_selections integer, max_selections integer, sort_order integer
)
language sql
security definer
stable
set search_path = public
as $$
  select g.id, g.name, g.selection_type, g.is_required, g.min_selections, g.max_selections, g.sort_order
  from modifier_groups g
  join products p on p.id = g.product_id
  where g.product_id = p_product_id and p.status = 'active' and p.is_published = true
  order by g.sort_order;
$$;
grant execute on function list_public_modifier_groups to anon, authenticated;

create function list_public_modifier_options(p_product_id uuid)
returns table (id uuid, modifier_group_id uuid, name text, price_cents integer, sort_order integer)
language sql
security definer
stable
set search_path = public
as $$
  select o.id, o.modifier_group_id, o.name, o.price_cents, o.sort_order
  from modifier_options o
  join modifier_groups g on g.id = o.modifier_group_id
  join products p on p.id = g.product_id
  where g.product_id = p_product_id and p.status = 'active' and p.is_published = true
  order by o.sort_order;
$$;
grant execute on function list_public_modifier_options to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Combos (Fase §5) — un producto "combo" que incluye otros productos. Sin
-- opciones configurables todavía (spec lo deja para después).
-- ---------------------------------------------------------------------------
alter table products add column if not exists is_combo boolean not null default false;

create table combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_product_id uuid not null references products (id) on delete cascade,
  component_product_id uuid not null references products (id) on delete cascade,
  quantity numeric not null default 1,
  sort_order integer not null default 0
);
create index combo_items_combo_id_idx on combo_items (combo_product_id);

alter table combo_items enable row level security;
create policy "combo_items_all_own_company" on combo_items for all
  using (exists (select 1 from products p where p.id = combo_product_id and is_company_member(p.company_id)))
  with check (
    exists (select 1 from products p where p.id = combo_product_id and is_company_member(p.company_id))
    -- El componente debe pertenecer a la MISMA empresa que el combo — evita
    -- que un combo referencie el producto de otra empresa.
    and exists (
      select 1 from products combo, products comp
      where combo.id = combo_product_id and comp.id = component_product_id
        and combo.company_id = comp.company_id
    )
  );

create function list_public_combo_items(p_product_id uuid)
returns table (component_name text, quantity numeric, unit product_unit)
language sql
security definer
stable
set search_path = public
as $$
  select cp.name, ci.quantity, cp.unit
  from combo_items ci
  join products cp on cp.id = ci.component_product_id
  join products p on p.id = ci.combo_product_id
  where ci.combo_product_id = p_product_id and p.status = 'active' and p.is_published = true
  order by ci.sort_order;
$$;
grant execute on function list_public_combo_items to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mesas (Fase §10/§11)
-- ---------------------------------------------------------------------------
create type table_status as enum ('available', 'occupied', 'reserved', 'attending');

create table restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  capacity integer,
  status table_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurant_tables_company_id_idx on restaurant_tables (company_id);

alter table restaurant_tables enable row level security;
create policy "restaurant_tables_all_own_company" on restaurant_tables for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- 5. orders: pedido en mesa (Fase §10) + marca de tiempo "listo" (para medir
-- tiempo de preparación, Fase §13/§24).
--
-- Agregar 'dine_in' obliga a recrear el tipo order_fulfillment (no se puede
-- agregar un valor y usarlo en la misma transacción). A diferencia de
-- subscription_status/sale_source (donde nada más dependía todavía del tipo
-- en el momento en que se cambiaron), acá SÍ hay dos funciones ya existentes
-- cuya firma referencia order_fulfillment (get_public_order,
-- create_public_order) — el DROP normal fallaría por esas dependencias, así
-- que se usa CASCADE y ambas se recrean más abajo con el mismo cuerpo que ya
-- tenían, solo re-vinculadas al tipo nuevo.
-- ---------------------------------------------------------------------------
alter type order_fulfillment rename to order_fulfillment_old;
create type order_fulfillment as enum ('pickup', 'delivery', 'dine_in');
alter table orders alter column fulfillment drop default;
alter table orders alter column fulfillment type order_fulfillment using fulfillment::text::order_fulfillment;
alter table orders alter column fulfillment set default 'pickup';
drop type order_fulfillment_old cascade;

alter table orders add column if not exists table_id uuid references restaurant_tables (id) on delete set null;
alter table orders add column if not exists ready_at timestamptz;

-- Recreadas por el CASCADE de arriba — mismo cuerpo que ya tenían desde la
-- Fase 8/9, solo re-vinculadas al nuevo order_fulfillment.
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
grant execute on function get_public_order to anon, authenticated;

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
  v_order_number text;
  v_subtotal integer := 0;
  v_item jsonb;
  v_product products;
  v_variant product_variants;
  v_variant_id uuid;
  v_quantity numeric;
  v_zone delivery_zones;
  v_delivery_fee integer := 0;
  v_delivery_status delivery_status_type := 'not_applicable';
  v_max_orders_month integer;
  v_orders_this_month integer;
  v_previous_stock numeric;
  v_new_stock numeric;
begin
  select * into v_company from companies where slug = p_company_slug;
  if v_company.id is null then
    raise exception 'Negocio no encontrado.';
  end if;

  select pl.limit_value into v_max_orders_month
    from subscriptions s
    join plan_limits pl on pl.plan_id = s.plan_id and pl.limit_key = 'max_orders_month'
    where s.company_id = v_company.id;

  if v_max_orders_month is not null then
    select count(*) into v_orders_this_month from orders
      where company_id = v_company.id and created_at >= date_trunc('month', now());
    if v_orders_this_month >= v_max_orders_month then
      raise exception 'Este negocio alcanzó su límite de pedidos de este mes. Intenta contactarlo directamente.';
    end if;
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

  v_order_number := 'P-' || lpad(v_seq::text, 6, '0');

  insert into orders (
    company_id, customer_id, order_number, customer_name, customer_phone, customer_email,
    fulfillment, delivery_address, delivery_city, delivery_neighborhood, delivery_reference,
    delivery_zone_id, recipient_name, recipient_phone, estimated_delivery_time, delivery_status,
    payment_method, payment_status, subtotal_cents, delivery_fee_cents, discount_cents, total_cents,
    notes, status
  ) values (
    v_company.id, v_customer_id, v_order_number,
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

      if v_product.track_inventory then
        v_previous_stock := v_product.current_stock;
        v_new_stock := greatest(v_previous_stock - v_quantity, 0);

        update products set current_stock = v_new_stock, updated_at = now() where id = v_product.id;

        insert into inventory_movements (
          company_id, product_id, movement_type, quantity, previous_stock, new_stock,
          reason, reference_type, reference_id
        ) values (
          v_company.id, v_product.id, 'out', -v_quantity, v_previous_stock, v_new_stock,
          'Pedido ' || v_order_number, 'order', v_order_id
        );
      end if;
    end if;
  end loop;

  return v_order_id;
end;
$$;
grant execute on function create_public_order to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. order_items / sale_items: modificadores elegidos + observaciones por
-- línea (Fase §9/§14 — "sin cebolla", "+ queso"). jsonb liviano, ej.
-- [{"name": "Queso", "price_cents": 3000}] — suficiente para mostrar en
-- cocina y en el recibo, sin necesitar más tablas de relación.
-- ---------------------------------------------------------------------------
alter table order_items add column if not exists modifiers jsonb not null default '[]'::jsonb;
alter table order_items add column if not exists notes text;

alter table sale_items add column if not exists modifiers jsonb not null default '[]'::jsonb;
alter table sale_items add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- 7. sales.source: reemplaza el "catalog" genérico de la fase anterior por
-- el detalle real que pide esta fase (Fase §19): POS, MENÚ, DOMICILIO, MESA,
-- PARA LLEVAR. Nadie depende todavía de 'catalog' en producción (la
-- migración que lo creó ni siquiera se ha corrido), así que se remapea sin
-- riesgo de perder información real.
-- ---------------------------------------------------------------------------
alter type sale_source rename to sale_source_old;
create type sale_source as enum ('pos', 'menu', 'delivery', 'table', 'takeout');
alter table sales alter column source drop default;
alter table sales alter column source type sale_source using (
  case source::text when 'catalog' then 'menu' else source::text end
)::sale_source;
alter table sales alter column source set default 'pos';
drop type sale_source_old;

-- ---------------------------------------------------------------------------
-- 8. create_dine_in_order(): el mesero toma el pedido de una mesa (Fase
-- §10/§34). Calcula el precio real de cada línea sumando el producto más
-- sus modificadores elegidos — nunca confía en un total enviado desde el
-- cliente. Descuenta inventario con apply_inventory_movement() (aquí sí es
-- seguro llamarla: quien invoca esta función es un mesero autenticado, no un
-- cliente anónimo, así que su propio chequeo is_company_member() pasa).
-- ---------------------------------------------------------------------------
create function create_dine_in_order(
  p_company_id uuid,
  p_table_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table restaurant_tables;
  v_seq integer;
  v_order orders;
  v_order_id uuid;
  v_item jsonb;
  v_mod jsonb;
  v_product products;
  v_quantity numeric;
  v_line_price integer;
  v_line_modifiers jsonb;
  v_line_notes text;
  v_subtotal integer := 0;
  v_mod_option modifier_options;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;

  select * into v_table from restaurant_tables where id = p_table_id and company_id = p_company_id;
  if v_table.id is null then
    raise exception 'Mesa no encontrada.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe tener al menos un producto.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = nullif(v_item ->> 'product_id', '')::uuid and company_id = p_company_id and status = 'active';
    if v_product.id is null then
      raise exception 'Uno de los productos ya no está disponible.';
    end if;
    v_quantity := coalesce((v_item ->> 'quantity')::numeric, 1);
    if v_quantity <= 0 then
      raise exception 'Cantidad inválida para %.', v_product.name;
    end if;

    v_line_price := v_product.price_cents;
    for v_mod in select * from jsonb_array_elements(coalesce(v_item -> 'modifiers', '[]'::jsonb)) loop
      select * into v_mod_option from modifier_options where id = nullif(v_mod ->> 'option_id', '')::uuid;
      if v_mod_option.id is not null then
        v_line_price := v_line_price + v_mod_option.price_cents;
      end if;
    end loop;
    v_subtotal := v_subtotal + round(v_line_price * v_quantity)::integer;
  end loop;

  update companies set orders_sequence = orders_sequence + 1
    where id = p_company_id
    returning orders_sequence into v_seq;

  insert into orders (
    company_id, order_number, customer_name, customer_phone,
    fulfillment, table_id, status, payment_method, payment_status,
    subtotal_cents, delivery_fee_cents, discount_cents, total_cents, notes
  ) values (
    p_company_id, 'P-' || lpad(v_seq::text, 6, '0'), 'Mesa ' || v_table.name, '',
    'dine_in', p_table_id, 'pending', 'cash', 'pending',
    v_subtotal, 0, 0, v_subtotal, nullif(trim(p_notes), '')
  )
  returning * into v_order;
  v_order_id := v_order.id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::numeric, 1);
    v_line_price := v_product.price_cents;
    v_line_modifiers := '[]'::jsonb;
    v_line_notes := nullif(trim(v_item ->> 'notes'), '');

    for v_mod in select * from jsonb_array_elements(coalesce(v_item -> 'modifiers', '[]'::jsonb)) loop
      select * into v_mod_option from modifier_options where id = nullif(v_mod ->> 'option_id', '')::uuid;
      if v_mod_option.id is not null then
        v_line_price := v_line_price + v_mod_option.price_cents;
        v_line_modifiers := v_line_modifiers || jsonb_build_object('name', v_mod_option.name, 'price_cents', v_mod_option.price_cents);
      end if;
    end loop;

    insert into order_items (
      order_id, product_id, product_name, quantity, unit, unit_price_cents, total_cents, modifiers, notes
    ) values (
      v_order_id, v_product.id, v_product.name, v_quantity, v_product.unit,
      v_line_price, round(v_line_price * v_quantity)::integer, v_line_modifiers, v_line_notes
    );

    if v_product.track_inventory and not v_product.is_combo then
      perform apply_inventory_movement(
        p_company_id, v_product.id, 'out', v_quantity,
        'Pedido ' || v_order.order_number, 'order', v_order_id
      );
    end if;
  end loop;

  update restaurant_tables set status = 'occupied', updated_at = now() where id = p_table_id;

  return v_order;
end;
$$;
grant execute on function create_dine_in_order to authenticated;

-- ---------------------------------------------------------------------------
-- 9. set_order_status(): agrega ready_at (para tiempo de preparación) y
-- libera la mesa cuando el pedido de mesa se entrega/cobra. Mismo cuerpo que
-- la Fase 15 (0022), con esos dos agregados.
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

  update orders set
    status = p_status,
    ready_at = case when p_status = 'ready' and v_order.ready_at is null then now() else v_order.ready_at end,
    updated_at = now()
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

  if p_status = 'delivered' and v_order.table_id is not null then
    update restaurant_tables set status = 'available', updated_at = now() where id = v_order.table_id;
  end if;

  if p_status = 'canceled' and v_order.payment_status = 'pending' then
    update orders set payment_status = 'canceled', updated_at = now()
      where id = p_order_id
      returning * into v_order;
    if v_order.table_id is not null then
      update restaurant_tables set status = 'available', updated_at = now() where id = v_order.table_id;
    end if;
  end if;

  return v_order;
end;
$$;

grant execute on function set_order_status to authenticated;

-- ---------------------------------------------------------------------------
-- 10. create_sale_from_order(): ahora deriva un `source` específico según
-- cómo se originó el pedido (Fase §19), y copia modificadores/observaciones
-- a la venta para que el recibo los conserve. Mismo cuerpo que la Fase 15
-- (0022) con esos dos ajustes.
-- ---------------------------------------------------------------------------
create or replace function create_sale_from_order(p_order_id uuid)
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
  v_source sale_source;
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

  v_source := case
    when v_order.table_id is not null then 'table'
    when v_order.fulfillment = 'delivery' then 'delivery'
    when v_order.fulfillment = 'pickup' then 'takeout'
    else 'menu'
  end;

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
    v_source, v_order.id
  )
  returning * into v_sale;

  insert into sale_items (
    sale_id, product_id, service_id, variant_id, item_type, name, quantity,
    unit_price_cents, discount_cents, total_cents, modifiers, notes
  )
  select
    v_sale.id, oi.product_id, oi.service_id, oi.variant_id,
    (case when oi.service_id is not null then 'service' else 'product' end)::sale_item_type,
    oi.product_name, oi.quantity, oi.unit_price_cents, 0, oi.total_cents, oi.modifiers, oi.notes
  from order_items oi
  where oi.order_id = p_order_id;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Reportes propios del vertical (Fase §24) — mismo principio que los
-- report_*() de la Fase 10: security invoker, respeta RLS, agregación
-- eficiente, nunca se le pide al navegador que descargue filas crudas.
-- ---------------------------------------------------------------------------
create function report_sales_by_hour(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_timezone text)
returns table (hour_of_day integer, total_cents bigint, sales_count integer)
language sql security invoker stable set search_path = public as $$
  select extract(hour from (s.created_at at time zone p_timezone))::integer,
    sum(s.total_cents)::bigint, count(*)::integer
  from sales s
  where s.company_id = p_company_id and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by 1
  order by 1;
$$;
grant execute on function report_sales_by_hour to authenticated;

create function report_sales_by_order_type(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns table (source sale_source, total_cents bigint, sales_count integer)
language sql security invoker stable set search_path = public as $$
  select s.source, sum(s.total_cents)::bigint, count(*)::integer
  from sales s
  where s.company_id = p_company_id and s.status = 'completed'
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by s.source
  order by sum(s.total_cents) desc;
$$;
grant execute on function report_sales_by_order_type to authenticated;

create function report_top_combos(p_company_id uuid, p_start timestamptz, p_end timestamptz, p_limit integer default 10)
returns table (name text, quantity numeric, total_cents bigint)
language sql security invoker stable set search_path = public as $$
  select si.name, sum(si.quantity), sum(si.total_cents)::bigint
  from sale_items si
  join sales s on s.id = si.sale_id
  join products p on p.id = si.product_id
  where s.company_id = p_company_id and s.status = 'completed' and p.is_combo = true
    and s.created_at >= p_start and s.created_at < p_end
    and is_company_member(p_company_id)
  group by si.name
  order by sum(si.total_cents) desc
  limit p_limit;
$$;
grant execute on function report_top_combos to authenticated;

create function report_avg_prep_time_minutes(p_company_id uuid, p_start timestamptz, p_end timestamptz)
returns numeric
language sql security invoker stable set search_path = public as $$
  select round(avg(extract(epoch from (ready_at - created_at)) / 60)::numeric, 1)
  from orders
  where company_id = p_company_id
    and status != 'canceled'
    and ready_at is not null
    and created_at >= p_start and created_at < p_end
    and is_company_member(p_company_id);
$$;
grant execute on function report_avg_prep_time_minutes to authenticated;
