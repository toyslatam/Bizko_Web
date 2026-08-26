-- =============================================================================
-- FASE 11 — Planes, límites y suscripciones
-- Convierte el "feature gating" antes hardcodeado en src/lib/plans.ts en
-- datos reales de base de datos: catálogo de features, features por plan y
-- límites por plan, consultables server-side. No se integra ningún proveedor
-- de pagos todavía — la suscripción se administra manualmente / vía trial.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. subscription_status: agrega 'expired'/'suspended' y renombra
-- 'trialing' -> 'trial' (vocabulario de la Fase 11). Postgres no permite usar
-- un valor de enum recién agregado en la misma transacción que lo agrega, así
-- que se recrea el tipo completo en vez de usar ALTER TYPE ... ADD VALUE.
-- ---------------------------------------------------------------------------
alter type subscription_status rename to subscription_status_old;
create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'expired', 'suspended');

alter table subscriptions alter column status drop default;
alter table subscriptions
  alter column status type subscription_status
  using (case status::text when 'trialing' then 'trial' else status::text end)::subscription_status;
alter table subscriptions alter column status set default 'trial';
drop type subscription_status_old;

-- ---------------------------------------------------------------------------
-- 2. subscriptions: campos de la Fase 11 §2.
-- ---------------------------------------------------------------------------
alter table subscriptions rename column current_period_end to end_date;
alter table subscriptions add column start_date timestamptz not null default now();
alter table subscriptions add column trial_ends_at timestamptz;
alter table subscriptions add column updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 3. plans: campos de la Fase 11 §1. Se retira `features` (jsonb suelto, sin
-- uso real) a favor de las tablas relacionales `plan_features`/`plan_limits`.
-- ---------------------------------------------------------------------------
alter table plans rename column monthly_price_cents to price_monthly_cents;
alter table plans add column price_yearly_cents integer not null default 0;
alter table plans add column slug text;
update plans set slug = code::text;
alter table plans alter column slug set not null;
alter table plans add constraint plans_slug_key unique (slug);
alter table plans add column currency text not null default 'COP';
alter table plans add column is_active boolean not null default true;
alter table plans add column is_recommended boolean not null default false;
alter table plans add column updated_at timestamptz not null default now();
alter table plans drop column features;

-- ---------------------------------------------------------------------------
-- 4. Catálogo de features (Fase 11 §6) — activables/desactivables por plan
-- independientemente del código (nunca `if (plan === "pro")` en el frontend).
-- ---------------------------------------------------------------------------
create table features (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  feature_key text not null references features (key) on delete cascade,
  enabled boolean not null default true,
  unique (plan_id, feature_key)
);

-- limit_value = null significa "ilimitado" (Fase 11 §8).
create table plan_limits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  limit_key text not null,
  limit_value integer,
  unique (plan_id, limit_key)
);

-- ---------------------------------------------------------------------------
-- 5. Seed: catálogo de features (Fase 11 §6).
-- ---------------------------------------------------------------------------
insert into features (key, name, description) values
  ('dashboard', 'Panel principal', 'Resumen del negocio y accesos rápidos.'),
  ('customers', 'Clientes', 'Gestión de clientes.'),
  ('products', 'Productos', 'Catálogo de productos.'),
  ('services', 'Servicios', 'Catálogo de servicios.'),
  ('sales', 'Ventas', 'Punto de venta.'),
  ('inventory', 'Inventario', 'Control de stock.'),
  ('cash', 'Caja', 'Apertura y cierre de caja.'),
  ('catalog', 'Catálogo público', 'Tienda en línea del negocio.'),
  ('orders', 'Pedidos', 'Pedidos desde el catálogo público.'),
  ('delivery', 'Delivery', 'Gestión de entregas a domicilio.'),
  ('reports', 'Reportes', 'Reportes y analítica básica.'),
  ('advanced_reports', 'Reportes avanzados', 'Analítica avanzada y comparativos.'),
  ('variants', 'Variantes de producto', 'Tallas, colores y otras variantes.'),
  ('appointments', 'Agenda de citas', 'Agenda para negocios con citas.'),
  ('work_orders', 'Órdenes de trabajo', 'Órdenes de trabajo de taller.'),
  ('recipes', 'Recetas', 'Recetas y producción.'),
  ('ai', 'Inteligencia artificial', 'Asistente con IA (próximamente).'),
  ('automation', 'Automatización', 'Automatizaciones (próximamente).')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Seed: features activas por plan (Fase 11 §3/§4/§5). Los módulos por
-- vertical (variants/appointments/work_orders/recipes) quedan disponibles en
-- los tres planes por ahora — están en el catálogo para poder restringirlos
-- desde un futuro panel de Super Admin sin tocar código (Fase 11 §20).
-- ---------------------------------------------------------------------------
insert into plan_features (plan_id, feature_key, enabled)
select p.id, f.key, true
from plans p
cross join features f
where f.key in (
  'dashboard', 'customers', 'products', 'services', 'sales', 'inventory', 'cash',
  'catalog', 'orders', 'reports', 'variants', 'appointments', 'work_orders', 'recipes'
)
on conflict (plan_id, feature_key) do nothing;

insert into plan_features (plan_id, feature_key, enabled)
select p.id, f.key, true
from plans p
cross join features f
where p.code in ('negocio', 'pro') and f.key in ('delivery', 'advanced_reports')
on conflict (plan_id, feature_key) do nothing;

insert into plan_features (plan_id, feature_key, enabled)
select p.id, f.key, true
from plans p
cross join features f
where p.code = 'pro' and f.key in ('ai', 'automation')
on conflict (plan_id, feature_key) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Seed: límites por plan (Fase 11 §3/§4/§5 — cifras referenciales).
-- ---------------------------------------------------------------------------
insert into plan_limits (plan_id, limit_key, limit_value)
select id, 'max_users', 2 from plans where code = 'basico'
union all select id, 'max_products', 100 from plans where code = 'basico'
union all select id, 'max_customers', 200 from plans where code = 'basico'
union all select id, 'max_orders_month', 100 from plans where code = 'basico'
union all select id, 'max_storage_mb', 250 from plans where code = 'basico'
union all select id, 'max_users', 5 from plans where code = 'negocio'
union all select id, 'max_products', 1000 from plans where code = 'negocio'
union all select id, 'max_customers', 2000 from plans where code = 'negocio'
union all select id, 'max_orders_month', 1000 from plans where code = 'negocio'
union all select id, 'max_storage_mb', 2000 from plans where code = 'negocio'
union all select id, 'max_users', null from plans where code = 'pro'
union all select id, 'max_products', null from plans where code = 'pro'
union all select id, 'max_customers', null from plans where code = 'pro'
union all select id, 'max_orders_month', null from plans where code = 'pro'
union all select id, 'max_storage_mb', 10000 from plans where code = 'pro'
on conflict (plan_id, limit_key) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Copy/precios de los planes (referenciales — Fase 11 §26, sin cobro).
-- ---------------------------------------------------------------------------
update plans set
  name = 'Básico',
  description = 'Lo esencial para empezar a ordenar tu negocio.',
  price_monthly_cents = 0,
  price_yearly_cents = 0
where code = 'basico';

update plans set
  name = 'Negocio',
  description = 'Catálogo, pedidos, delivery e inventario para crecer.',
  price_monthly_cents = 4900000,
  price_yearly_cents = 49000000,
  is_recommended = true
where code = 'negocio';

update plans set
  name = 'Pro',
  description = 'Reportes avanzados, automatización e IA para tu negocio.',
  price_monthly_cents = 9900000,
  price_yearly_cents = 99000000
where code = 'pro';

-- ---------------------------------------------------------------------------
-- 9. create_company_with_owner(): ahora asigna trial de 14 días en vez de
-- suscripción activa directa (Fase 11 §2/§14). Misma firma y mismo tipo de
-- retorno que la versión de la Fase 2 — CREATE OR REPLACE es seguro aquí.
-- ---------------------------------------------------------------------------
create or replace function create_company_with_owner(
  p_name text,
  p_slug text,
  p_business_type business_type,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_country text default 'CO',
  p_currency text default 'COP',
  p_timezone text default 'America/Bogota'
)
returns companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
  v_basic_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear un negocio.';
  end if;

  insert into companies (name, slug, business_type, phone, email, address, city, country, currency, timezone)
  values (p_name, p_slug, p_business_type, p_phone, p_email, p_address, p_city, p_country, p_currency, p_timezone)
  returning * into v_company;

  insert into company_members (company_id, user_id, role, status)
  values (v_company.id, auth.uid(), 'owner', 'active');

  select id into v_basic_plan_id from plans where code = 'basico';
  insert into subscriptions (company_id, plan_id, status, start_date, trial_ends_at)
  values (v_company.id, v_basic_plan_id, 'trial', now(), now() + interval '14 days');

  insert into profiles (id, email)
  values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (id) do nothing;

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Uso actual vs. límites del plan (Fase 11 §9/§19/§23) — una sola
-- función, cálculo eficiente por agregación, nunca se pide al frontend que
-- descargue todas las filas para contar.
-- ---------------------------------------------------------------------------
create function get_plan_usage(p_company_id uuid)
returns table (limit_key text, limit_value integer, current_usage integer)
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_month_start timestamptz;
begin
  if not is_company_member(p_company_id) then
    raise exception 'No perteneces a esta empresa.';
  end if;
  v_month_start := date_trunc('month', now());

  return query
  select pl.limit_key, pl.limit_value,
    (case pl.limit_key
      when 'max_users' then
        (select count(*)::integer from company_members where company_id = p_company_id and status = 'active')
      when 'max_products' then
        (select count(*)::integer from products where company_id = p_company_id and status = 'active')
      when 'max_customers' then
        (select count(*)::integer from customers where company_id = p_company_id and status = 'active')
      when 'max_orders_month' then
        (select count(*)::integer from orders where company_id = p_company_id and created_at >= v_month_start)
      else 0
    end)::integer
  from plan_limits pl
  join subscriptions s on s.plan_id = pl.plan_id
  where s.company_id = p_company_id;
end;
$$;
grant execute on function get_plan_usage to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Features activas de la empresa (según su plan actual).
-- ---------------------------------------------------------------------------
create function get_active_feature_keys(p_company_id uuid)
returns table (feature_key text)
language sql
security invoker
stable
set search_path = public
as $$
  select pf.feature_key
  from plan_features pf
  join subscriptions s on s.plan_id = pf.plan_id
  where s.company_id = p_company_id
    and pf.enabled = true
    and is_company_member(p_company_id);
$$;
grant execute on function get_active_feature_keys to authenticated;

-- ---------------------------------------------------------------------------
-- 12. RLS — catálogo de planes/features de solo lectura para cualquier
-- usuario autenticado (necesario para comparar planes en el flujo de
-- upgrade); solo un futuro Super Admin (is_platform_admin) puede escribir.
-- Ninguna empresa puede modificar su propio plan_id/status/límites desde el
-- frontend (Fase 11 §21) — subscriptions solo tiene política de SELECT para
-- miembros, nunca de INSERT/UPDATE/DELETE para ellos.
-- ---------------------------------------------------------------------------
alter table features enable row level security;
alter table plan_features enable row level security;
alter table plan_limits enable row level security;

create policy "features_select_all" on features for select using (true);
create policy "plan_features_select_all" on plan_features for select using (true);
create policy "plan_limits_select_all" on plan_limits for select using (true);

create policy "plans_admin_manage" on plans for all
  using (is_platform_admin()) with check (is_platform_admin());
create policy "features_admin_manage" on features for all
  using (is_platform_admin()) with check (is_platform_admin());
create policy "plan_features_admin_manage" on plan_features for all
  using (is_platform_admin()) with check (is_platform_admin());
create policy "plan_limits_admin_manage" on plan_limits for all
  using (is_platform_admin()) with check (is_platform_admin());
create policy "subscriptions_admin_manage" on subscriptions for all
  using (is_platform_admin()) with check (is_platform_admin());

-- ---------------------------------------------------------------------------
-- 13. create_public_order(): agrega el control de límite mensual de pedidos
-- del plan (Fase 11 §12) — el catálogo público es anónimo, así que el único
-- lugar seguro para aplicar este límite es dentro de la RPC misma, no en el
-- frontend. Mismo cuerpo que la versión de la Fase 9 (soporte de variantes),
-- con el chequeo de límite agregado justo después de resolver la empresa.
-- ---------------------------------------------------------------------------
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
  v_max_orders_month integer;
  v_orders_this_month integer;
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
