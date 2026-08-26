-- Let an admin delete a booking -- but only one that never involved money.
--
-- There was no delete policy at all, so RLS denied it for everyone including
-- admins. Adding one needs care: bookings cascade to payments and feedback, so
-- an unguarded delete quietly destroys the money trail and any review attached
-- to the job.
--
-- Two guards, at different levels:
--   * invoices.booking_id is ON DELETE RESTRICT already, so a billed job
--     cannot be deleted at all. That is deliberate -- a raised bill is a
--     record, and the way to void it is a credit note, not an erase.
--   * the trigger below refuses anything with a settled payment, which covers
--     money taken before a bill was ever raised.
--
-- What is left is exactly the junk worth clearing: abandoned checkouts and
-- cancelled bookings nobody paid for. Everything else should be cancelled,
-- which keeps the row and the history.

create policy "bookings_delete_admin" on public.bookings
  for delete using (private.is_admin());

create or replace function private.prevent_deleting_settled_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.payments
     where booking_id = old.id and status in ('paid', 'refunded')
  ) then
    raise exception
      'This booking has money against it and cannot be deleted. Cancel it instead, so the payment record survives.'
      using errcode = 'check_violation';
  end if;

  if old.status = 'completed' then
    raise exception
      'A completed job cannot be deleted. Cancel it instead if it should not have been marked done.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create trigger prevent_deleting_settled_booking
  before delete on public.bookings
  for each row execute function private.prevent_deleting_settled_booking();
