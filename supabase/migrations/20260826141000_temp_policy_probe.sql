-- TEMPORARY, dropped by the next migration.
create or replace function public.policy_probe()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.polname,
        'cmd', p.polcmd::text,
        'permissive', p.polpermissive,
        'roles', (select coalesce(array_agg(r.rolname), array['PUBLIC']) from pg_roles r where r.oid = any(p.polroles)),
        'using', pg_get_expr(p.polqual, p.polrelid),
        'check', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname), '[]'::jsonb)
      from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='support_requests'),
    'anon_grants', (
      select coalesce(jsonb_agg(privilege_type order by privilege_type), '[]'::jsonb)
      from information_schema.role_table_grants
      where grantee='anon' and table_schema='public' and table_name='support_requests'),
    'rls_enabled', (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='support_requests'),
    'rls_forced', (select relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='support_requests')
  );
$$;
revoke all on function public.policy_probe() from public;
revoke execute on function public.policy_probe() from anon, authenticated;
