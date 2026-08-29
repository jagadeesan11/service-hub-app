-- Booking-level discounts.
--
-- A discount here is a shop decision, not a customer one: an admin sets it on
-- the booking and every money path downstream reads the discounted figure.
-- That is deliberately the opposite of an advertised price cut — it needs no
-- pricing engine, and because only an admin can set it, it does not depend on
-- the client-supplied total_price being trustworthy.

alter table public.bookings
  add column discount_amount numeric(10, 2) not null default 0,
  add column discount_reason text;

alter table public.bookings
  add constraint bookings_discount_non_negative
    check (discount_amount >= 0),
  -- A discount larger than the job would mean the shop owes the customer
  -- money, which is a refund, not a discount.
  add constraint bookings_discount_within_total
    check (discount_amount <= total_price),
  add constraint bookings_discount_reason_length
    check (discount_reason is null or char_length(discount_reason) <= 200);

-- What is actually owed. Generated rather than maintained by hand so it can
-- never drift out of step with the two columns it comes from; every money path
-- below reads this instead of total_price.
alter table public.bookings
  add column net_price numeric(10, 2)
    generated always as (total_price - discount_amount) stored;

comment on column public.bookings.discount_amount is
  'Admin-granted reduction. Set before payment is taken; net_price is what is charged.';
comment on column public.bookings.net_price is
  'total_price - discount_amount. Read by payments, Razorpay orders and invoices.';

-- customer guard ---------------------------------------------------------------

-- Unchanged except for the two new columns in the forbidden list. Without
-- them a customer could PATCH their own booking with a discount and pay it.
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
    or new.discount_amount is distinct from old.discount_amount
    or new.discount_reason is distinct from old.discount_reason
    or new.payment_method is distinct from old.payment_method
    or new.technician_id is distinct from old.technician_id
    or new.service_id is distinct from old.service_id
    or new.asset_id is distinct from old.asset_id
    or new.addon_ids is distinct from old.addon_ids
    or new.user_id is distinct from old.user_id
  then
    raise exception 'Only Nexora can change a booking''s price, discount, contents, payment method or technician'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- settled-money guard ----------------------------------------------------------

-- Once money has actually been received, changing the discount would leave the
-- invoice disagreeing with the payment. Reducing what someone already paid is
-- a refund, and refunds are not this feature.
create or replace function private.guard_discount_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.discount_amount is distinct from old.discount_amount
     and exists (
       select 1 from public.payments
        where booking_id = new.id and status = 'paid'
     )
  then
    raise exception 'This booking is already paid, so a discount cannot be applied to it now'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_discount_after_payment
  before update on public.bookings
  for each row execute function private.guard_discount_after_payment();

-- money paths ------------------------------------------------------------------

-- Recreated solely to bill net_price rather than total_price.
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
  values (b.id, b.net_price, 'created', 'cash');

  return b;
end;
$$;

revoke all on function public.choose_cash_on_delivery(uuid) from public;
revoke execute on function public.choose_cash_on_delivery(uuid) from anon;
grant execute on function public.choose_cash_on_delivery(uuid) to authenticated;

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
  values (b.id, b.net_price, 'paid', 'offline');

  return b;
end;
$$;

revoke all on function public.admin_mark_paid_offline(uuid, text) from public;
revoke execute on function public.admin_mark_paid_offline(uuid, text) from anon;
grant execute on function public.admin_mark_paid_offline(uuid, text) to authenticated;

-- invoice ----------------------------------------------------------------------

-- Recreated to bill net_price and to print the discount as its own line. The
-- service and add-on lines keep their full prices: a bill that quietly shrinks
-- the service line hides the fact that a discount was given, which is exactly
-- what the customer should be able to see.
create or replace function private.raise_invoice_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.services%rowtype;
  cfg public.app_settings%rowtype;
  p public.profiles%rowtype;
  addon_lines jsonb := '[]'::jsonb;
  addon_total numeric(10, 2) := 0;
  service_amount numeric(10, 2);
  items jsonb;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  if exists (select 1 from public.invoices where booking_id = new.id) then
    return new;
  end if;

  select * into s from public.services where id = new.service_id;
  select * into cfg from public.app_settings where id;
  select * into p from public.profiles where id = new.user_id;

  select coalesce(jsonb_agg(jsonb_build_object('description', a.name, 'amount', a.price)), '[]'::jsonb),
         coalesce(sum(a.price), 0)
    into addon_lines, addon_total
    from public.addons a
   where a.id = any(new.addon_ids);

  -- The booking's total is what was agreed and is authoritative. The service
  -- line is the remainder after add-ons, so the printed lines always sum to
  -- the amount actually charged even if an add-on's price changed since.
  service_amount := new.total_price - addon_total;

  if service_amount < 0 then
    -- Add-on prices moved enough to make the split nonsense. One honest line
    -- beats a breakdown that implies a discount nobody gave.
    items := jsonb_build_array(
      jsonb_build_object('description', coalesce(s.name, 'Service'), 'amount', new.total_price)
    );
  else
    items := jsonb_build_array(
      jsonb_build_object('description', coalesce(s.name, 'Service'), 'amount', service_amount)
    ) || addon_lines;
  end if;

  if new.discount_amount > 0 then
    items := items || jsonb_build_array(jsonb_build_object(
      'description', coalesce(nullif(trim(new.discount_reason), ''), 'Discount'),
      'amount', -new.discount_amount
    ));
  end if;

  insert into public.invoices (booking_id, number, line_items, total, payment_method, seller, buyer)
  values (
    new.id,
    private.next_invoice_number(now()),
    items,
    new.net_price,
    new.payment_method,
    jsonb_build_object(
      'name', coalesce(cfg.shop_name, 'Moto Ceramic'),
      'address_line', cfg.shop_address_line,
      'city', cfg.shop_city,
      'postal_code', cfg.shop_postal_code,
      'phone', cfg.support_phone,
      'email', cfg.support_email
    ),
    jsonb_build_object(
      'name', coalesce(new.contact_name, p.name),
      'phone', coalesce(new.contact_phone, p.phone),
      'address_line', coalesce(new.service_address, p.address_line),
      'city', coalesce(new.service_city, p.city),
      'postal_code', coalesce(new.service_postal_code, p.postal_code)
    )
  );

  return new;
end;
$$;
