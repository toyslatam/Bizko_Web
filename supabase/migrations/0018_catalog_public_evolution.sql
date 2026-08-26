-- =============================================================================
-- FASE 15.1 — Evolución del catálogo público
-- Evoluciona el catálogo existente (no lo reemplaza): banner, productos
-- destacados, búsqueda y WhatsApp preparado (sin integrar todavía). Reutiliza
-- las funciones get_public_company/list_public_products ya existentes desde
-- la Fase 7/9 — se les agregan columnas/parámetros, no se crean funciones
-- paralelas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. companies: banner + WhatsApp (Fase 15.1 §11/§12 — el número solo queda
-- guardado, no se integra la API de WhatsApp todavía).
-- ---------------------------------------------------------------------------
alter table companies add column if not exists banner_url text;
alter table companies add column if not exists whatsapp_number text;

-- ---------------------------------------------------------------------------
-- 2. get_public_company(): agrega banner_url y whatsapp_number al catálogo
-- público. Cambia la lista de columnas, así que se DROP + CREATE (no se
-- puede hacer CREATE OR REPLACE cuando cambian las columnas de salida).
-- ---------------------------------------------------------------------------
drop function if exists get_public_company(text);

create function get_public_company(p_slug text)
returns table (
  id uuid, name text, slug text, business_type business_type,
  logo_url text, banner_url text, description text, phone text, whatsapp_number text,
  city text, business_hours text, delivery_enabled boolean, pickup_enabled boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select id, name, slug, business_type, logo_url, banner_url, description, phone, whatsapp_number,
    city, business_hours, delivery_enabled, pickup_enabled
  from companies
  where slug = p_slug;
$$;

grant execute on function get_public_company to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. list_public_products(): agrega is_featured (ya existía en products,
-- desde la Fase 9, sin usarse todavía) y un parámetro de búsqueda opcional
-- (Fase 15.1 §6). DROP + CREATE por el mismo motivo que arriba.
-- ---------------------------------------------------------------------------
drop function if exists list_public_products(uuid, uuid);

create function list_public_products(p_company_id uuid, p_category_id uuid default null, p_search text default null)
returns table (
  id uuid, category_id uuid, name text, description text, image_url text,
  price_cents integer, unit product_unit, sku text,
  track_inventory boolean, current_stock numeric, has_variants boolean, is_featured boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select id, category_id, name, description, image_url, price_cents, unit, sku,
    track_inventory, current_stock, has_variants, is_featured
  from products
  where company_id = p_company_id
    and status = 'active'
    and is_published = true
    and (p_category_id is null or category_id = p_category_id)
    and (p_search is null or name ilike '%' || p_search || '%')
  order by is_featured desc, name;
$$;

grant execute on function list_public_products to anon, authenticated;
