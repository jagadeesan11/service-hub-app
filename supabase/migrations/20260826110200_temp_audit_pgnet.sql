-- TEMPORARY, dropped shortly. Answers where pg_net's callable objects live,
-- so the extension is not relocated blind.
create or replace function public.security_audit()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'http_post_locations', (
      select coalesce(jsonb_agg(distinct n.nspname), '[]'::jsonb)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.proname = 'http_post'
    ),
    'net_schema_exists', (select exists (select 1 from pg_namespace where nspname = 'net')),
    'extensions_schema_exists', (select exists (select 1 from pg_namespace where nspname = 'extensions')),
    'pg_net_relocatable', (
      select coalesce((select e.extrelocatable from pg_extension x
        join pg_available_extensions ae on ae.name = x.extname
        join pg_extension e on e.oid = x.oid where x.extname = 'pg_net'), false)
    ),
    'pg_net_registered_schema', (
      select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
       where e.extname = 'pg_net'
    )
  );
$$;
revoke all on function public.security_audit() from public;
revoke execute on function public.security_audit() from anon, authenticated;
