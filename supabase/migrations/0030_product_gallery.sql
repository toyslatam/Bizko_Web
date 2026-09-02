-- =============================================================================
-- FASE — Galería de fotos por producto (catálogo público)
--
-- products.image_url sigue siendo la foto principal (la que se ve en las
-- tarjetas de la grilla — no se toca, sigue igual). Esta tabla agrega fotos
-- ADICIONALES para el detalle del producto, mostradas en un carrusel
-- deslizable. No se consulta en la grilla (evita N+1 a 500 productos), solo
-- en la vista de detalle/quick-view, igual que variantes y modificadores.
-- =============================================================================
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_id_idx on product_images (product_id, sort_order);

alter table product_images enable row level security;
create policy "product_images_all_own_company" on product_images for all
  using (exists (select 1 from products p where p.id = product_id and is_company_member(p.company_id)))
  with check (exists (select 1 from products p where p.id = product_id and is_company_member(p.company_id)));

create function list_public_product_images(p_product_id uuid)
returns table (id uuid, image_url text, sort_order integer)
language sql
security definer
stable
set search_path = public
as $$
  select pi.id, pi.image_url, pi.sort_order
  from product_images pi
  join products p on p.id = pi.product_id
  where pi.product_id = p_product_id and p.status = 'active' and p.is_published = true
  order by pi.sort_order;
$$;
grant execute on function list_public_product_images to anon, authenticated;
