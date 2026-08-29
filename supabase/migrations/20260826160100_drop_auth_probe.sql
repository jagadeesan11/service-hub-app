-- The auth probe from 20260826160000 has served its purpose. Nothing that can
-- read auth.users should outlive the question it was created to answer.
drop function if exists public.auth_probe();
