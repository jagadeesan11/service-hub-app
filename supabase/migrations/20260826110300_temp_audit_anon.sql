-- TEMPORARY, dropped by the next migration.
create or replace function public.security_audit()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'write_policies_reaching_anon', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'table', c.relname, 'policy', p.polname,
               'cmd', case p.polcmd when 'a' then 'INSERT' when 'w' then 'UPDATE'
                                    when 'd' then 'DELETE' when '*' then 'ALL' else p.polcmd::text end,
               'roles', (select array_agg(r.rolname) from pg_roles r where r.oid = any(p.polroles))
             ) order by c.relname, p.polname), '[]'::jsonb)
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and p.polcmd in ('a','w','d','*')
         and (p.polroles = '{0}'::oid[] or exists (
               select 1 from pg_roles r where r.oid = any(p.polroles) and r.rolname = 'anon'))
    ),
    'select_policies_reaching_anon', (
      select coalesce(jsonb_agg(distinct c.relname order by c.relname), '[]'::jsonb)
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and p.polcmd in ('r','*')
         and (p.polroles = '{0}'::oid[] or exists (
               select 1 from pg_roles r where r.oid = any(p.polroles) and r.rolname = 'anon'))
    )
  );
$$;
revoke all on function public.security_audit() from public;
revoke execute on function public.security_audit() from anon, authenticated;
