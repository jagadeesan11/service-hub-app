-- TEMPORARY. Reproduces the checks Supabase's Security Advisor runs, so the
-- findings can be read rather than guessed at. Dropped by the next migration.

create or replace function private.security_audit()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'rls_disabled', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ),
    'rls_on_but_no_policy', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    ),
    'definer_functions_without_search_path', (
      select coalesce(jsonb_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname), '[]'::jsonb)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
         and p.prosecdef
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
         )
    ),
    'views_in_public', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('v', 'm')
    ),
    'extensions_in_public', (
      select coalesce(jsonb_agg(e.extname order by e.extname), '[]'::jsonb)
        from pg_extension e join pg_namespace n on n.oid = e.extnamespace
       where n.nspname = 'public'
    ),
    'tables_readable_by_anon', (
      select coalesce(jsonb_agg(distinct c.relname order by c.relname), '[]'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_policy p on p.polrelid = c.oid
       where n.nspname = 'public' and p.polcmd in ('r', '*')
         and 'anon' = any (select rolname from pg_roles where oid = any (p.polroles))
    ),
    'public_buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'size_limit', b.file_size_limit, 'mime', b.allowed_mime_types
             ) order by b.id), '[]'::jsonb)
        from storage.buckets b where b.public
    )
  );
$$;

grant execute on function private.security_audit() to service_role;
