-- TEST ONLY. Dropped by the very next migration.
--
-- Read-only: reports how the booking_events trigger and its lock-down actually
-- landed on the live database. Deliberately does not exercise the trigger by
-- updating a real booking — a status change fires the notification triggers
-- too, and a rolled-back transaction does not un-send a push to a customer.

create or replace function public.temp_booking_events_probe()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'trigger', (
      select jsonb_build_object(
        'name', t.tgname,
        -- 'O' means enabled in the ordinary origin case, i.e. it will fire.
        'enabled', t.tgenabled,
        'on_table', c.relname,
        'function', p.proname
      )
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_proc p on p.oid = t.tgfoid
      where t.tgname = 'record_booking_event' and not t.tgisinternal
    ),
    'rls_enabled', (
      select c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'booking_events'
    ),
    'policies', (
      select jsonb_agg(polname) from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      where c.relname = 'booking_events'
    ),
    'grants', (
      select jsonb_object_agg(grantee, privs) from (
        select grantee, jsonb_agg(privilege_type order by privilege_type) as privs
        from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'booking_events'
          and grantee in ('anon', 'authenticated', 'service_role')
        group by grantee
      ) g
    ),
    'function_is_security_definer', (
      select p.prosecdef from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname = 'record_booking_event'
    )
  );
$$;

grant execute on function public.temp_booking_events_probe() to service_role;
