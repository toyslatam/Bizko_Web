-- bizko — Supabase Storage
-- Convención de rutas: <bucket>/<company_id>/<archivo>. Las políticas exigen
-- que el primer segmento de la ruta coincida con la company_id del usuario,
-- así cada negocio queda aislado dentro del mismo bucket.

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('product-images', 'product-images', true),
  ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects for select
  using (bucket_id = 'logos');

create policy "logos_write_own_company" on storage.objects for insert
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "logos_update_own_company" on storage.objects for update
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "logos_delete_own_company" on storage.objects for delete
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "product_images_public_read" on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product_images_write_own_company" on storage.objects for insert
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "product_images_update_own_company" on storage.objects for update
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "product_images_delete_own_company" on storage.objects for delete
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = current_company_id()::text);

-- documents: privado, solo el propio negocio puede leer y escribir
create policy "documents_read_own_company" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "documents_write_own_company" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = current_company_id()::text);

create policy "documents_delete_own_company" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = current_company_id()::text);
