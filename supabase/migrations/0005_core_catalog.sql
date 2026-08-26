-- bizko — Fase 3: CORE operativo (clientes, productos, servicios, categorías)
--
-- Las tablas ya existían desde la Fase 1 (0001_init.sql) pero les faltan
-- columnas que pide esta fase: nombre/apellido separados, estado
-- activo/inactivo, unidad de venta, costo y timestamps de actualización.
-- No hay datos reales todavía en estas tablas (recién se construye su UI),
-- así que se puede alterar el esquema sin migración de datos.

create type entity_status as enum ('active', 'inactive');
create type product_unit as enum ('unidad', 'kg', 'g', 'libra', 'litro', 'ml', 'metro', 'servicio');

-- =========================================================================
-- CLIENTES
-- =========================================================================
alter table customers
  add column if not exists first_name text not null default '',
  add column if not exists last_name text,
  add column if not exists city text,
  add column if not exists status entity_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

update customers set first_name = coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Cliente')
  where first_name = '';
update customers
  set last_name = nullif(trim(substring(full_name from position(' ' in full_name))), '')
  where last_name is null and position(' ' in full_name) > 0;

alter table customers drop column full_name;
alter table customers alter column first_name drop default;
create index customers_status_idx on customers (company_id, status);

-- =========================================================================
-- CATEGORÍAS DE PRODUCTOS
-- =========================================================================
alter table product_categories
  add column if not exists description text,
  add column if not exists status entity_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

-- =========================================================================
-- PRODUCTOS
-- =========================================================================
alter table products
  add column if not exists cost_cents integer not null default 0,
  add column if not exists unit product_unit not null default 'unidad',
  -- status (activo/inactivo, uso interno) es independiente de is_published
  -- (visibilidad en el catálogo público, fase futura).
  add column if not exists status entity_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create index products_status_idx on products (company_id, status);

-- =========================================================================
-- CATEGORÍAS DE SERVICIOS
-- =========================================================================
alter table service_categories
  add column if not exists description text,
  add column if not exists status entity_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

-- =========================================================================
-- SERVICIOS
-- =========================================================================
alter table services
  add column if not exists image_url text,
  add column if not exists status entity_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create index services_status_idx on services (company_id, status);
