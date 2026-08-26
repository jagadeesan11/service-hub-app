-- Harden internal RLS/trigger helper functions (Phase 1 follow-up).
-- `supabase db advisors --type security` flagged:
--   - set_updated_at() had a mutable search_path
--   - is_admin, technician_id_for_current_user, handle_new_user,
--     prevent_self_role_escalation, enforce_technician_status_only_update
--     are SECURITY DEFINER functions directly callable via
--     /rest/v1/rpc/<name> by anon/authenticated, since PostgREST exposes
--     everything in `public` (see supabase/config.toml [api]).
-- Moving them to a schema PostgREST doesn't expose keeps them usable by
-- RLS policies/triggers (which resolve functions by OID, unaffected by a
-- schema move) while making them unreachable over the REST API.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.set_updated_at() set search_path = public;
alter function public.set_updated_at() set schema private;
alter function public.is_admin() set schema private;
alter function public.technician_id_for_current_user() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.prevent_self_role_escalation() set schema private;
alter function public.enforce_technician_status_only_update() set schema private;
