-- Phase 2, Prompt 8: image upload support for services.

insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do nothing;

-- Public bucket downloads bypass RLS via the /storage/v1/object/public/
-- endpoint, but the admin panel also lists/reads via the authenticated
-- client, and uploads/deletes always go through RLS regardless of bucket
-- visibility, so both directions need explicit policies.

create policy "service_images_public_read" on storage.objects
  for select using (bucket_id = 'service-images');

create policy "service_images_admin_write" on storage.objects
  for all
  using (bucket_id = 'service-images' and private.is_admin())
  with check (bucket_id = 'service-images' and private.is_admin());
