-- TEST ONLY. Dropped by the very next migration. Read-only.
create or replace function public.temp_policy_probe()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'policy', p.polname,
    'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
  ) order by c.relname)
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  where p.polname in ('categories_admin_insert', 'services_admin_insert');
$$;
grant execute on function public.temp_policy_probe() to service_role;
