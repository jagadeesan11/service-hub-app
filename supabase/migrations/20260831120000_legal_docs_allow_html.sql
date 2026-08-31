-- Let the legal-docs bucket hold HTML, not only PDF.
--
-- 20260826120000 locked this bucket to application/pdf, which was right for
-- the shape it had then. The published privacy policy and terms are HTML
-- pages, and with only PDF allowed there was no way to upload them under a
-- correct content type — so they went in as text/plain and every browser
-- printed the source at customers instead of rendering the page.
--
-- The size cap stays. So does PDF: a signed document may still want to be one.
--
-- Deliberately NOT text/plain or a wildcard. This bucket is world-readable by
-- design, and an open type list on a public bucket is how it turns into a
-- place to park whatever anyone likes.

update storage.buckets
   set allowed_mime_types = array['text/html', 'application/pdf']
 where id = 'legal-docs';
