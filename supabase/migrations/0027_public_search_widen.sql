-- =============================================================================
-- FASE — Catálogo público, tienda de ropa: buscador ampliado
--
-- El pedido explícito de esta fase es que el buscador encuentre por nombre,
-- categoría, SKU y descripción (hoy `list_public_products` solo compara
-- `name ilike`). Es el único cambio de base de datos de esta fase — todo lo
-- demás es visual — y es aditivo: mismas columnas de salida, mismo
-- comportamiento cuando p_search es null, solo se amplía el WHERE. No toca
-- precios, inventario, carrito ni pedidos.
-- =============================================================================
create or replace function list_public_products(p_company_id uuid, p_category_id uuid default null, p_search text default null)
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
  select p.id, p.category_id, p.name, p.description, p.image_url, p.price_cents, p.unit, p.sku,
    p.track_inventory, p.current_stock, p.has_variants, p.is_featured
  from products p
  left join product_categories c on c.id = p.category_id
  where p.company_id = p_company_id
    and p.status = 'active'
    and p.is_published = true
    and (p_category_id is null or p.category_id = p_category_id)
    and (
      p_search is null
      or p.name ilike '%' || p_search || '%'
      or p.sku ilike '%' || p_search || '%'
      or p.description ilike '%' || p_search || '%'
      or c.name ilike '%' || p_search || '%'
    )
  order by p.is_featured desc, p.name;
$$;
grant execute on function list_public_products to anon, authenticated;
