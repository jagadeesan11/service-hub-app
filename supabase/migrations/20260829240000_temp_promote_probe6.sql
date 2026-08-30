-- TEMPORARY, dropped by the next migration in this same session.
create or replace function private.promote_for_test(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  alter table public.profiles disable trigger prevent_self_role_escalation;
  update public.profiles set role = p_role where id = p_id;
  alter table public.profiles enable trigger prevent_self_role_escalation;
end;
$$;
create or replace function public.promote_for_test(p_id uuid, p_role text)
returns void language sql security definer set search_path = public as $$
  select private.promote_for_test(p_id, p_role);
$$;
revoke all on function public.promote_for_test(uuid, text) from public;
revoke execute on function public.promote_for_test(uuid, text) from anon, authenticated;
