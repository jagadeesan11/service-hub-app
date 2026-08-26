-- Fix a real bug caught via live testing: pg_net's default 5s timeout was
-- too short for send-booking-notification's cold start (DB lookups + an
-- outbound call to Expo's push API), so the webhook silently timed out
-- every time. Raised to 15s.

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
        ),
        timeout_milliseconds := 15000
      );
    end if;
  end if;

  return new;
end;
$$;
