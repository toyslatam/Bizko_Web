-- =============================================================================
-- FASE — Catálogo público: rango de precio para productos con variantes
--
-- list_public_products() no trae precio de variantes (el producto base no
-- tiene uno propio cuando has_variants=true), así que el catálogo público
-- mostraba "$0" en cada tarjeta con variantes. En vez de consultar variantes
-- producto por producto en la grilla (N+1, se rompe a 500 productos), un solo
-- RPC trae min/max por producto para toda la empresa de una vez.
-- =============================================================================
create function list_public_variant_price_ranges(p_company_id uuid)
returns table (product_id uuid, min_price_cents integer, max_price_cents integer)
language sql
security definer
stable
set search_path = public
as $$
  select v.product_id, min(v.price_cents)::integer, max(v.price_cents)::integer
  from product_variants v
  join products p on p.id = v.product_id
  where p.company_id = p_company_id
    and p.has_variants = true
    and p.status = 'active'
    and p.is_published = true
    and v.status = 'active'
  group by v.product_id;
$$;
grant execute on function list_public_variant_price_ranges to anon, authenticated;
