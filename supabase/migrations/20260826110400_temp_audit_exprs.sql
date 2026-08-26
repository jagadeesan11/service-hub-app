-- TEMPORARY, dropped by the next migration.
create or replace function public.security_audit()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'table', c.relname, 'policy', p.polname,
           'cmd', case p.polcmd when 'a' then 'INSERT' when 'w' then 'UPDATE'
                                when 'd' then 'DELETE' when '*' then 'ALL' else p.polcmd::text end,
           'using', pg_get_expr(p.polqual, p.polrelid),
           'check', pg_get_expr(p.polwithcheck, p.polrelid)
         ) order by c.relname, p.polname), '[]'::jsonb)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and p.polcmd in ('a','w','d','*')
     -- Only the ones whose gate does NOT mention the caller's identity: those
     -- are the policies that could evaluate true with no session at all.
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '') !~ 'auth\.uid|is_admin'
     and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') !~ 'auth\.uid|is_admin';
$$;
revoke all on function public.security_audit() from public;
revoke execute on function public.security_audit() from anon, authenticated;
