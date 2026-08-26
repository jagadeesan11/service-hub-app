-- A public bucket for the published legal documents.
--
-- Both stores require the privacy policy to open anonymously -- a reviewer
-- clicks the link with no session and no cookies. A public Supabase bucket
-- serves that over the /storage/v1/object/public/ endpoint, which needs no
-- auth at all, so the policy is reachable without making the source repo
-- public or standing up a separate host.
--
-- Same shape as service-images: public reads bypass RLS on the public
-- endpoint, but writes always go through RLS, so both need policies.

insert into storage.buckets (id, name, public)
values ('legal-docs', 'legal-docs', true)
on conflict (id) do nothing;

create policy "legal_docs_public_read" on storage.objects
  for select using (bucket_id = 'legal-docs');

create policy "legal_docs_admin_write" on storage.objects
  for all
  using (bucket_id = 'legal-docs' and private.is_admin())
  with check (bucket_id = 'legal-docs' and private.is_admin());
