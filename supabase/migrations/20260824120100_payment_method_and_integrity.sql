-- Cash on delivery, plus the server-side integrity this feature exposes.
--
-- Until now a customer could PATCH their own booking to status='confirmed'
-- and their own payment to status='paid' straight from the anon key: the
-- bookings_update policy and enforce_technician_status_only_update both let
-- the owning customer through unchecked, and the mobile app did exactly that
-- after Razorpay's callback. Adding COD makes "confirmed but not paid" a
-- legitimate state, which would bury that hole rather than fix it, so the
-- state machine moves into the database here.
--
-- After this migration a customer can only ever do two things to a booking:
-- create it as pending_payment, and cancel it. Everything else -- confirming,
-- pricing, assigning, choosing COD -- goes through code that checks first.

alter table public.bookings
  add column payment_method text not null default 'online'
    check (payment_method in ('online', 'cod'));

alter table public.payments
  add column method text not null default 'razorpay'
    check (method in ('razorpay', 'cash'));

comment on column public.bookings.payment_method is
  'How this booking is paid for. Set to cod only via public.choose_cash_on_delivery().';

-- Escape hatch for the two code paths that are allowed to move a booking
-- through its state machine: choose_cash_on_delivery() below, and the
-- verify-razorpay-payment edge function (which runs as service_role and is
-- exempt anyway). Transaction-local, and pg_catalog.set_config is not
-- reachable over PostgREST, so a client cannot raise it for itself.
create or replace function private.booking_state_change_allowed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('nexora.booking_state_change', true), '') = 'on';
$$;

-- insert ---------------------------------------------------------------------

create or replace function private.enforce_booking_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  online_ok boolean;
begin
  if private.is_admin() then
    return new;
  end if;

  select online_payment_enabled into online_ok from public.app_settings where id;
  if not coalesce(online_ok, true) then
    raise exception 'Online booking is closed right now'
      using errcode = 'check_violation';
  end if;

  -- Forced rather than validated: the client has no say, so there is no
  -- payload that produces a confirmed-but-unpaid booking. COD is chosen
  -- afterwards through choose_cash_on_delivery().
  new.status := 'pending_payment';
  new.payment_method := 'online';
  new.technician_id := null;

  return new;
end;
$$;

create trigger enforce_booking_insert_integrity
  before insert on public.bookings
  for each row execute function private.enforce_booking_insert_integrity();

-- update ---------------------------------------------------------------------

create or replace function private.enforce_customer_booking_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin() or private.booking_state_change_allowed() then
    return new;
  end if;

  -- Only constrains the owning customer. Technicians are handled by
  -- enforce_technician_status_only_update; service_role has no uid and is
  -- trusted server code.
  if old.user_id is distinct from (select auth.uid()) then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status <> 'cancelled' then
      raise exception 'A booking is confirmed by Nexora, not by the customer'
        using errcode = 'insufficient_privilege';
    end if;
    if old.status in ('completed', 'cancelled', 'in_progress') then
      raise exception 'A booking that is already % cannot be cancelled here', old.status
        using errcode = 'check_violation';
    end if;
  end if;

  if new.total_price is distinct from old.total_price
    or new.payment_method is distinct from old.payment_method
    or new.technician_id is distinct from old.technician_id
    or new.service_id is distinct from old.service_id
    or new.asset_id is distinct from old.asset_id
    or new.addon_ids is distinct from old.addon_ids
    or new.user_id is distinct from old.user_id
  then
    raise exception 'Only Nexora can change a booking''s price, contents, payment method or technician'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger enforce_customer_booking_transitions
  before update on public.bookings
  for each row execute function private.enforce_customer_booking_transitions();

-- payments -------------------------------------------------------------------

-- create-razorpay-order writes this row with the caller's own session, so
-- inserts stay open -- but only as 'created'. Marking money as received is
-- server work.
create or replace function private.enforce_payment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin() or private.booking_state_change_allowed() then
    return new;
  end if;
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status <> 'created' then
    raise exception 'A payment starts as created; only Nexora can settle it'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'Only Nexora can change a payment''s status'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger enforce_payment_integrity
  before insert or update on public.payments
  for each row execute function private.enforce_payment_integrity();

-- cash on delivery -----------------------------------------------------------

create or replace function public.choose_cash_on_delivery(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  cod_ok boolean;
begin
  select cod_enabled into cod_ok from public.app_settings where id;
  if not coalesce(cod_ok, false) then
    raise exception 'Cash on delivery is not available right now'
      using errcode = 'check_violation';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'no_data_found';
  end if;

  -- security definer bypasses RLS, so ownership is checked by hand.
  if b.user_id is distinct from (select auth.uid()) and not private.is_admin() then
    raise exception 'Not your booking' using errcode = 'insufficient_privilege';
  end if;

  if b.status <> 'pending_payment' then
    raise exception 'This booking is already %, so it cannot switch to cash', b.status
      using errcode = 'check_violation';
  end if;

  perform set_config('nexora.booking_state_change', 'on', true);

  update public.bookings
     set payment_method = 'cod',
         status = 'confirmed'
   where id = b.id
  returning * into b;

  -- The money is still owed, so the payment row exists and stays 'created'
  -- until an admin marks it collected. Without it, COD jobs would be
  -- invisible in revenue reporting.
  insert into public.payments (booking_id, amount, status, method)
  values (b.id, b.total_price, 'created', 'cash');

  return b;
end;
$$;

revoke all on function public.choose_cash_on_delivery(uuid) from public;
grant execute on function public.choose_cash_on_delivery(uuid) to authenticated;
