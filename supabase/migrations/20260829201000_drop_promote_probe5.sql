-- Removes the verification helper from 20260829200000.
drop function if exists public.promote_for_test(uuid, text);
drop function if exists private.promote_for_test(uuid, text);
