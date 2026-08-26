-- Fix a second real bug caught via live testing: @supabase/server's
-- "secret" auth mode validates the `apikey` header, not `Authorization:
-- Bearer`. The trigger was sending the service key in the wrong header,
-- so every call 401'd with "Invalid credentials" even once the Vault
-- secret held the correct sb_secret_... key.

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
          'apikey', service_key
        ),
        body := jsonb_build_object(
          'booking_id', new.id,
          'old_status', old.status,
          'new_status', new.status
        ),
        timeout_milliseconds := 15000
      );
    end if;
  end if;

  return new;
end;
$$;
