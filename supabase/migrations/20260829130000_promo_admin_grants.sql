-- Restore the write grants the promo tables need.
--
-- 20260829110000 revoked insert/update/delete on both tables from
-- `authenticated` and left the admin RLS policies in place. But an admin IS
-- `authenticated` — the role is the same, only private.is_admin() differs — so
-- the policy had nothing underneath it and the admin page could not create a
-- code at all. Postgres checks the grant first and never reaches the policy.
--
-- This is the same two-layer distinction as 20260826120000, applied the other
-- way round: there, anon kept SELECT and lost writes for good, because no
-- policy was ever meant to let anon write. Here the policies exist and are the
-- intended control, so the grants have to be present for RLS to do its job.

grant insert, update, delete on public.promo_codes to authenticated;
grant insert, update, delete on public.promo_redemptions to authenticated;

-- anon stays locked out entirely. The blanket revoke and the default
-- privileges from 20260826120000 already cover it; this is belt and braces
-- for two tables created after that migration ran.
revoke insert, update, delete on public.promo_codes from anon;
revoke insert, update, delete on public.promo_redemptions from anon;
