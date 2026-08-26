-- Security hardening, from an audit of the live database.
--
-- Every write policy in `public` already gates on auth.uid() or is_admin(), so
-- anon cannot write today. But all 34 of them are TO PUBLIC, which *includes*
-- anon — the only thing standing between an anonymous request and a write is
-- the correctness of every policy expression, forever. One future policy
-- written without an identity check and the door is open.
--
-- Revoking the grants puts a second, independent lock on it: anon keeps SELECT
-- (the app browses the catalogue before sign-in) and loses the ability to write
-- regardless of what any policy says.

revoke insert, update, delete, truncate on all tables in schema public from anon;

-- Same rule for tables added later, so this does not quietly decay. Applies to
-- objects created by the migration role, which is how every table here is made.
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;

-- The legal-docs bucket was created public with no size limit and no type
-- allowlist: an admin account could upload anything, of any size, and it would
-- be served from the project's own domain. Storage sends HTML as text/plain
-- with nosniff, so HTML was never going to render anyway — PDF is the format
-- that actually works for a document meant to be read in a browser.
update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array['application/pdf']
 where id = 'legal-docs';

-- The audit function has served its purpose. It was security definer and
-- deliberately short-lived; leaving it behind would be its own finding.
drop function if exists public.security_audit();
