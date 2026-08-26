-- bizko — actualiza las políticas de Storage al modelo multi-empresa de
-- 0003 (is_company_member en vez de current_company_id, que ya no existe).
-- El DROP FUNCTION CASCADE de 0003 ya eliminó las políticas antiguas sobre
-- storage.objects si 0002 se había ejecutado; este archivo las recrea.

drop policy if exists "logos_write_own_company" on storage.objects;
drop policy if exists "logos_update_own_company" on storage.objects;
drop policy if exists "logos_delete_own_company" on storage.objects;
drop policy if exists "product_images_write_own_company" on storage.objects;
drop policy if exists "product_images_update_own_company" on storage.objects;
drop policy if exists "product_images_delete_own_company" on storage.objects;
drop policy if exists "documents_read_own_company" on storage.objects;
drop policy if exists "documents_write_own_company" on storage.objects;
drop policy if exists "documents_delete_own_company" on storage.objects;

create policy "logos_write_own_company" on storage.objects for insert
  with check (bucket_id = 'logos' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "logos_update_own_company" on storage.objects for update
  using (bucket_id = 'logos' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "logos_delete_own_company" on storage.objects for delete
  using (bucket_id = 'logos' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "product_images_write_own_company" on storage.objects for insert
  with check (bucket_id = 'product-images' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "product_images_update_own_company" on storage.objects for update
  using (bucket_id = 'product-images' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "product_images_delete_own_company" on storage.objects for delete
  using (bucket_id = 'product-images' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "documents_read_own_company" on storage.objects for select
  using (bucket_id = 'documents' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "documents_write_own_company" on storage.objects for insert
  with check (bucket_id = 'documents' and is_company_member(((storage.foldername(name))[1])::uuid));

create policy "documents_delete_own_company" on storage.objects for delete
  using (bucket_id = 'documents' and is_company_member(((storage.foldername(name))[1])::uuid));
