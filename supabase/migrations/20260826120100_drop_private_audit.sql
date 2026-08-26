-- The first audit attempt defined the function in `private`, before it turned
-- out PostgREST only exposes `public`. The hardening migration dropped the
-- public copy; this drops the original, so no security-definer function
-- created for a one-off audit is left behind.
drop function if exists private.security_audit();
