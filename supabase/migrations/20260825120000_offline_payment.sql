-- Confirming a booking whose money arrived outside the app.
--
-- 20260824120100 deliberately gave `pending_payment` no manual advance, on the
-- grounds that an admin marking a booking confirmed would be recording money
-- nobody collected. That is still true of a bare status change -- but the real
-- case it blocked is legitimate: a customer pays by direct UPI or bank
-- transfer and the shop needs to confirm the slot.
--
-- So the action exists, but it books the money at the same time. A confirmed
-- booking with no matching payment row is the accounting hole; a status
-- dropdown would have created one silently.

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check
  check (payment_method in ('online', 'cod', 'offline'));

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('razorpay', 'cash', 'offline'));

comment on column public.bookings.payment_method is
  'How this booking is paid for. cod via public.choose_cash_on_delivery(); offline via public.admin_mark_paid_offline().';

create or replace function public.admin_mark_paid_offline(
  p_booking_id uuid,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  -- security definer bypasses RLS, so the caller is checked by hand.
  if not private.is_admin() then
    raise exception 'Only an admin can record an offline payment'
      using errcode = 'insufficient_privilege';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'no_data_found';
  end if;

  if b.status <> 'pending_payment' then
    raise exception 'This booking is already %, so it is not awaiting payment', b.status
      using errcode = 'check_violation';
  end if;

  perform set_config('nexora.booking_state_change', 'on', true);

  update public.bookings
     set payment_method = 'offline',
         status = 'confirmed'
   where id = b.id
  returning * into b;

  -- Marked paid, not merely created: the money is already in hand, which is
  -- the whole point of this path.
  insert into public.payments (booking_id, amount, status, method)
  values (b.id, b.total_price, 'paid', 'offline');

  return b;
end;
$$;

revoke all on function public.admin_mark_paid_offline(uuid, text) from public;
revoke execute on function public.admin_mark_paid_offline(uuid, text) from anon;
grant execute on function public.admin_mark_paid_offline(uuid, text) to authenticated;
