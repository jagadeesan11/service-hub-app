-- Hard limits on the service-images bucket.
--
-- The bucket accepted any MIME type at any size, and the uploader only had an
-- accept="image/*" hint on the file picker — which is a filter, not a check.
-- A phone photo goes straight in at 8-12 MB, and every customer then downloads
-- all of it over mobile data, because nothing resizes it on the way through.
--
-- The admin UI now downscales before uploading, so these are the backstop for
-- anything that does not go through it.

update storage.buckets
   set file_size_limit = 2097152,  -- 2 MB; the UI targets ~300 KB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'service-images';
