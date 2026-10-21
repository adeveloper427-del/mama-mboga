-- Public-read image buckets. Uploads go to <bucket>/<user id>/<file>, and a user
-- can only write inside their own folder. 5 MB limit, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('shops',    'shops',    true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('avatars',  'avatars',  true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "images_upload_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('products', 'shops', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "images_update_own_folder" on storage.objects for update to authenticated
  using (bucket_id in ('products', 'shops', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('products', 'shops', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "images_remove_own_folder" on storage.objects for delete to authenticated
  using (bucket_id in ('products', 'shops', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
