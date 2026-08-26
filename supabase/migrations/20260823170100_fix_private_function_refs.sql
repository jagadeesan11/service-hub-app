-- Fix a real bug caught via live testing: migration 20260823160200 moved
-- is_admin()/technician_id_for_current_user() from public to private, but
-- PL/pgSQL function bodies resolve schema-qualified names in their source
-- text at execution time (unlike RLS USING/WITH CHECK expressions, which
-- resolve to a function OID at CREATE POLICY time and survive a schema
-- move). These two trigger functions still called `public.is_admin()`
-- literally and broke with "function public.is_admin() does not exist".

create or replace function private.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Only admins can change a profile''s role';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_technician_status_only_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin() or old.user_id = auth.uid() then
    return new;
  end if;

  if old.technician_id = private.technician_id_for_current_user() then
    if new.user_id is distinct from old.user_id
      or new.service_id is distinct from old.service_id
      or new.asset_id is distinct from old.asset_id
      or new.addon_ids is distinct from old.addon_ids
      or new.scheduled_at is distinct from old.scheduled_at
      or new.technician_id is distinct from old.technician_id
      or new.total_price is distinct from old.total_price
    then
      raise exception 'Technicians may only update booking status';
    end if;
  end if;

  return new;
end;
$$;
