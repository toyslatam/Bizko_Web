-- bizko — esquema inicial (CORE multi-tenant)
-- Diseñado para Supabase Cloud y portable a Supabase self-hosted (Postgres puro
-- + supabase/auth-schema, sin extensiones propietarias fuera de auth.uid()).

create extension if not exists "pgcrypto";

-- =========================================================================
-- ENUMS
-- =========================================================================
create type plan_code as enum ('basico', 'negocio', 'pro');
create type user_role as enum ('super_admin', 'owner', 'manager', 'employee');
create type business_type as enum (
  'bakery', 'produce', 'moto_wash', 'barbershop', 'laundry',
  'pet_shop', 'workshop', 'food', 'boutique'
);
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready',
  'out_for_delivery', 'delivered', 'canceled'
);
create type order_fulfillment as enum ('pickup', 'delivery');
create type payment_method as enum ('cash_on_delivery', 'cash', 'card', 'transfer');

-- =========================================================================
-- PLATAFORMA: planes, empresas, usuarios, suscripciones
-- =========================================================================
create table plans (
  id uuid primary key default gen_random_uuid(),
  code plan_code not null unique,
  name text not null,
  description text not null,
  monthly_price_cents integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type business_type not null,
  logo_url text,
  phone text,
  address text,
  currency text not null default 'COP',
  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 0,
  created_at timestamptz not null default now()
);

-- Perfil de aplicación 1:1 con auth.users. company_id es null para
-- super_admin (administra la plataforma, no un negocio puntual).
create table app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  role user_role not null default 'owner',
  full_name text not null,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index app_users_company_id_idx on app_users (company_id);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  plan_id uuid not null references plans (id),
  status subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index subscriptions_company_id_idx on subscriptions (company_id);

-- =========================================================================
-- HELPERS de RLS
-- =========================================================================
create function current_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from app_users where auth_user_id = auth.uid();
$$;

create function current_user_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from app_users where auth_user_id = auth.uid();
$$;

create function is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from app_users where auth_user_id = auth.uid()), false);
$$;

-- =========================================================================
-- CORE: clientes, catálogo, ventas, pedidos, finanzas, inventario
-- =========================================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create index customers_company_id_idx on customers (company_id);

create table customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  label text not null default 'Casa',
  address text not null,
  city text,
  notes text
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
create index product_categories_company_id_idx on product_categories (company_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  category_id uuid references product_categories (id) on delete set null,
  name text not null,
  description text,
  image_url text,
  price_cents integer not null default 0,
  sku text,
  track_stock boolean not null default true,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 5,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index products_company_id_idx on products (company_id);

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);
create index service_categories_company_id_idx on service_categories (company_id);

create table services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  category_id uuid references service_categories (id) on delete set null,
  name text not null,
  description text,
  price_cents integer not null default 0,
  duration_minutes integer,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index services_company_id_idx on services (company_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  user_id uuid not null references app_users (id),
  total_cents integer not null default 0,
  payment_method payment_method not null default 'cash',
  created_at timestamptz not null default now()
);
create index sales_company_id_idx on sales (company_id);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  service_id uuid references services (id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit_price_cents integer not null default 0
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  customer_id uuid references customers (id) on delete set null,
  status order_status not null default 'pending',
  fulfillment order_fulfillment not null default 'pickup',
  address_id uuid references customer_addresses (id) on delete set null,
  payment_method payment_method not null default 'cash_on_delivery',
  total_cents integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index orders_company_id_idx on orders (company_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  service_id uuid references services (id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit_price_cents integer not null default 0
);

create table delivery_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  courier_name text,
  status order_status not null default 'pending',
  dispatched_at timestamptz,
  delivered_at timestamptz
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id) on delete cascade,
  sale_id uuid references sales (id) on delete cascade,
  method payment_method not null,
  amount_cents integer not null default 0,
  paid_at timestamptz,
  check (order_id is not null or sale_id is not null)
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null
);
create index expense_categories_company_id_idx on expense_categories (company_id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  category_id uuid references expense_categories (id) on delete set null,
  description text not null,
  amount_cents integer not null default 0,
  spent_at date not null default current_date
);
create index expenses_company_id_idx on expenses (company_id);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id)
);
create index inventory_company_id_idx on inventory (company_id);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  quantity_delta numeric not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index inventory_movements_company_id_idx on inventory_movements (company_id);

create table cash_registers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  opened_by uuid not null references app_users (id),
  opening_amount_cents integer not null default 0,
  closing_amount_cents integer,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index cash_registers_company_id_idx on cash_registers (company_id);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references cash_registers (id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  amount_cents integer not null default 0,
  reason text not null,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- ROW LEVEL SECURITY — aislamiento multi-tenant obligatorio
-- =========================================================================
alter table companies enable row level security;
alter table app_users enable row level security;
alter table subscriptions enable row level security;
alter table customers enable row level security;
alter table customer_addresses enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table delivery_orders enable row level security;
alter table payments enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table inventory enable row level security;
alter table inventory_movements enable row level security;
alter table cash_registers enable row level security;
alter table cash_movements enable row level security;
alter table plans enable row level security;

-- plans: catálogo público de lectura (necesario para mostrar precios sin sesión)
create policy "plans_select_all" on plans for select using (true);

-- companies: cada usuario ve/edita solo su propia empresa; super_admin ve todas
create policy "companies_select_own" on companies for select
  using (id = current_company_id() or is_super_admin());
create policy "companies_update_own" on companies for update
  using (id = current_company_id() or is_super_admin());

-- app_users: un usuario ve a sus compañeros de equipo (misma company_id)
create policy "app_users_select_own_company" on app_users for select
  using (auth_user_id = auth.uid() or company_id = current_company_id() or is_super_admin());
create policy "app_users_update_self" on app_users for update
  using (auth_user_id = auth.uid() or is_super_admin());

create policy "subscriptions_select_own" on subscriptions for select
  using (company_id = current_company_id() or is_super_admin());

-- Tablas de negocio: patrón estándar company_id = current_company_id()
create policy "customers_all_own_company" on customers for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "customer_addresses_all_own_company" on customer_addresses for all
  using (exists (select 1 from customers c where c.id = customer_id and c.company_id = current_company_id()) or is_super_admin())
  with check (exists (select 1 from customers c where c.id = customer_id and c.company_id = current_company_id()));

create policy "product_categories_all_own_company" on product_categories for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "products_all_own_company" on products for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

-- El catálogo público puede leer productos publicados sin sesión (para /store/[slug])
create policy "products_select_published" on products for select
  using (is_published = true);

create policy "service_categories_all_own_company" on service_categories for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "services_all_own_company" on services for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "services_select_published" on services for select
  using (is_published = true);

create policy "sales_all_own_company" on sales for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "sale_items_all_own_company" on sale_items for all
  using (exists (select 1 from sales s where s.id = sale_id and s.company_id = current_company_id()) or is_super_admin())
  with check (exists (select 1 from sales s where s.id = sale_id and s.company_id = current_company_id()));

create policy "orders_all_own_company" on orders for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "order_items_all_own_company" on order_items for all
  using (exists (select 1 from orders o where o.id = order_id and o.company_id = current_company_id()) or is_super_admin())
  with check (exists (select 1 from orders o where o.id = order_id and o.company_id = current_company_id()));

create policy "delivery_orders_all_own_company" on delivery_orders for all
  using (exists (select 1 from orders o where o.id = order_id and o.company_id = current_company_id()) or is_super_admin())
  with check (exists (select 1 from orders o where o.id = order_id and o.company_id = current_company_id()));

create policy "payments_all_own_company" on payments for all
  using (
    exists (select 1 from orders o where o.id = order_id and o.company_id = current_company_id())
    or exists (select 1 from sales s where s.id = sale_id and s.company_id = current_company_id())
    or is_super_admin()
  );

create policy "expense_categories_all_own_company" on expense_categories for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "expenses_all_own_company" on expenses for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "inventory_all_own_company" on inventory for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "inventory_movements_all_own_company" on inventory_movements for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "cash_registers_all_own_company" on cash_registers for all
  using (company_id = current_company_id() or is_super_admin())
  with check (company_id = current_company_id());

create policy "cash_movements_all_own_company" on cash_movements for all
  using (exists (select 1 from cash_registers cr where cr.id = cash_register_id and cr.company_id = current_company_id()) or is_super_admin())
  with check (exists (select 1 from cash_registers cr where cr.id = cash_register_id and cr.company_id = current_company_id()));

-- =========================================================================
-- SEED: planes por defecto
-- =========================================================================
insert into plans (code, name, description, monthly_price_cents, features) values
  ('basico', 'Básico', 'Lo esencial para empezar a ordenar tu negocio.',
    0, '["core.ventas", "core.clientes", "finanzas.caja"]'),
  ('negocio', 'Negocio', 'Catálogo, pedidos e inventario para crecer.',
    4900000, '["core.ventas", "core.clientes", "catalogo.productos", "catalogo.pedidos_online", "inventario", "finanzas.caja", "finanzas.gastos"]'),
  ('pro', 'Pro', 'Automatización e inteligencia artificial para tu negocio.',
    9900000, '["core.ventas", "core.clientes", "catalogo.productos", "catalogo.pedidos_online", "inventario", "finanzas.caja", "finanzas.gastos", "reportes.avanzados", "automatizacion", "ia.asistente"]');
