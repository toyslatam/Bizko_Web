-- =============================================================================
-- Personalización de color del catálogo público (Fase 15.1 §12).
-- Alcance a propósito: el color elegido por el negocio SOLO afecta su propio
-- catálogo público (/store/[slug]/**) — nunca el panel interno de bizko, que
-- mantiene el Design System fijo para todos los negocios (consistencia y
-- calidad, spec §12 "no romper el Design System").
-- =============================================================================

alter table companies add column if not exists accent_color text;

-- get_public_company(): agrega accent_color. Cambia columnas de salida, así
-- que se DROP + CREATE (mismo patrón usado en toda la Fase 9+).
drop function if exists get_public_company(text);

create function get_public_company(p_slug text)
returns table (
  id uuid, name text, slug text, business_type business_type,
  logo_url text, banner_url text, description text, phone text, whatsapp_number text,
  city text, business_hours text, delivery_enabled boolean, pickup_enabled boolean,
  accent_color text
)
language sql
security definer
stable
set search_path = public
as $$
  select id, name, slug, business_type, logo_url, banner_url, description, phone, whatsapp_number,
    city, business_hours, delivery_enabled, pickup_enabled, accent_color
  from companies
  where slug = p_slug;
$$;

grant execute on function get_public_company to anon, authenticated;
