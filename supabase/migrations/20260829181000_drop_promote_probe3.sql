-- Removes the verification helper from 20260829180000. Nothing that can mint
-- an admin should outlive the test it was written for.
drop function if exists public.promote_for_test(uuid, text);
drop function if exists private.promote_for_test(uuid, text);
