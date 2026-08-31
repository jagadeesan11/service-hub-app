-- Revert 20260831120000. Allowing text/html here does not achieve anything.
--
-- That migration widened this bucket to text/html so the privacy policy and
-- terms could be uploaded under a correct content type. The upload does then
-- succeed, and the object metadata really does record text/html — but Supabase
-- Storage serves HTML from a PUBLIC bucket as `text/plain` with
-- `X-Content-Type-Options: nosniff` regardless, on purpose: a public bucket
-- that rendered HTML would let anyone who can write to it run scripts on the
-- project's own domain.
--
-- Verified against the live bucket: metadata mimetype=text/html, response
-- Content-Type=text/plain, CF-Cache-Status=MISS — the origin, not a cache.
--
-- So the documents cannot be hosted here as web pages at all, and the widened
-- type list is a standing invitation to upload something executable to a
-- world-readable bucket for no benefit. They are served from the admin app's
-- public directory instead, which returns real text/html.
--
-- PDF stays allowed: a signed copy is a reasonable thing to keep here.

update storage.buckets
   set allowed_mime_types = array['application/pdf']
 where id = 'legal-docs';
