-- Removes the test-only probe from 20260831160000. It confirmed that both
-- insert policies now read `private.is_full_admin()` on the live database.
drop function if exists public.temp_policy_probe();
