-- Removes the verification helper from 20260829170000. It could set any
-- profile's role and bypassed prevent_self_role_escalation to do it; nothing
-- that can mint an admin should outlive the test it was written for.
drop function if exists public.promote_for_test(uuid, text);
drop function if exists private.promote_for_test(uuid, text);
