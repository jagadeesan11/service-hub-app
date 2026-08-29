-- TEMPORARY, dropped by the next migration.
-- Returns only the ALGORITHM PREFIX of each password hash (e.g. "$2a$10$"),
-- never the salt or the digest, plus where each account's email is mirrored.
create or replace function public.auth_probe()
returns jsonb language sql security definer set search_path = auth, public stable as $$
  select jsonb_build_object(
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'email', u.email,
        'phone', u.phone,
        'hash_prefix', left(u.encrypted_password, 7),
        'hash_len', length(u.encrypted_password),
        'identities', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'provider', i.provider,
            'identity_email', i.identity_data ->> 'email'
          )), '[]'::jsonb)
          from auth.identities i where i.user_id = u.id)
      ) order by u.created_at), '[]'::jsonb)
      from auth.users u),
    'pgcrypto_available', (select exists (select 1 from pg_extension where extname = 'pgcrypto'))
  );
$$;
revoke all on function public.auth_probe() from public;
revoke execute on function public.auth_probe() from anon, authenticated;
