-- Phase 7, Prompt 18: notify on bookings.status changes via a Postgres
-- trigger + webhook to the send-booking-notification Edge Function.
--
-- The function call needs to authenticate as service_role (to read across
-- users' device_tokens), but that key must never appear in migration SQL
-- (this file is committed to git). It's read at runtime from Supabase
-- Vault instead — the actual secret value is set out-of-band via
-- `select vault.create_secret(...)`, never through a migration.

create extension if not exists pg_net;

create or replace function private.notify_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  service_key text;
  function_url text := 'https://plwbkyoxryhpbkjbkjcf.supabase.co/functions/v1/send-booking-notification';
begin
  if new.status is distinct from old.status then
    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'edge_function_service_key';

    if service_key is not null then
      perform net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'booking_id', new.id,
          'old_status', old.status,
          'new_status', new.status
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger booking_status_notify
  after update on public.bookings
  for each row execute function private.notify_booking_status_change();
