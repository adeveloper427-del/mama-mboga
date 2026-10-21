create policy "read own images" on storage.objects for select to authenticated
  using (bucket_id in ('products', 'shops', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
