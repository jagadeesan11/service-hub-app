-- create_booking refuses a slot the shop is not open for.
--
-- Without this, opening hours are something the app draws rather than
-- something the shop has: the picker would hide a Sunday slot while the API
-- accepted one, and the first anyone would know is a customer arriving at a
-- locked door.
--
-- Dropped and recreated rather than replaced because the body changes; the
-- signature is unchanged from 20260829120000.

create or replace function public.create_booking(
  p_service_id uuid,
  p_scheduled_at timestamptz,
  p_asset_id uuid default null,
  p_addon_ids uuid[] default '{}'::uuid[],
  p_contact_name text default null,
  p_contact_phone text default null,
  p_service_address text default null,
  p_service_city text default null,
  p_service_postal_code text default null,
  p_needs_pickup boolean default false,
  p_pickup_notes text default null,
  p_promo_code text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  attrs jsonb := '{}'::jsonb;
  owner uuid;
  price numeric(10, 2);
  promo jsonb;
  promo_id uuid := null;
  promo_discount numeric(10, 2) := 0;
  b public.bookings%rowtype;
begin
  if uid is null then
    raise exception 'You need to be signed in to book' using errcode = 'insufficient_privilege';
  end if;

  if p_scheduled_at is null or p_scheduled_at < now() then
    raise exception 'Pick a time in the future' using errcode = 'check_violation';
  end if;

  -- Checked here as well as in the picker. An admin is exempt: the shop can
  -- always take a job outside its own hours if it chooses to.
  if not private.is_admin() and not private.is_open_at(p_scheduled_at) then
    raise exception 'We are closed at that time. Pick another slot.'
      using errcode = 'check_violation';
  end if;

  if p_asset_id is not null then
    select attributes, user_id into attrs, owner
      from public.customer_assets where id = p_asset_id;
    if not found then
      raise exception 'That vehicle no longer exists' using errcode = 'no_data_found';
    end if;
    if owner is distinct from uid then
      raise exception 'Not your vehicle' using errcode = 'insufficient_privilege';
    end if;
  end if;

  price := private.compute_booking_price(p_service_id, coalesce(attrs, '{}'::jsonb), p_addon_ids);

  if p_promo_code is not null and trim(p_promo_code) <> '' then
    -- Re-checked here, not trusted from the Apply step. A code can expire, be
    -- switched off, or hit its cap between the customer applying it and
    -- confirming — and the booking should say so rather than quietly charging
    -- the full price for something they believe is discounted.
    promo := private.evaluate_promo_code(p_promo_code, uid, p_service_id, price);

    if not (promo ->> 'valid')::boolean then
      raise exception '%', promo ->> 'reason' using errcode = 'check_violation';
    end if;

    promo_id := (promo ->> 'promo_code_id')::uuid;
    promo_discount := (promo ->> 'discount_amount')::numeric;
  end if;

  -- user_id is taken from the session, never from an argument: passing it in
  -- would let a caller create bookings against someone else's account.
  --
  -- status, payment_method and technician_id are deliberately not set here.
  -- enforce_booking_insert_integrity forces them, and it also refuses the
  -- insert outright when online booking is switched off.
  insert into public.bookings (
    user_id, service_id, asset_id, addon_ids, scheduled_at, total_price,
    promo_code_id, promo_discount_amount,
    contact_name, contact_phone, service_address, service_city,
    service_postal_code, needs_pickup, pickup_notes
  )
  values (
    uid, p_service_id, p_asset_id, coalesce(p_addon_ids, '{}'::uuid[]), p_scheduled_at, price,
    promo_id, promo_discount,
    p_contact_name, p_contact_phone, p_service_address, p_service_city,
    p_service_postal_code, coalesce(p_needs_pickup, false),
    nullif(trim(coalesce(p_pickup_notes, '')), '')
  )
  returning * into b;

  if promo_id is not null then
    -- Same transaction as the booking. A redemption that could be written
    -- separately would drift: either a discount nobody is recorded as using,
    -- or a claim against a booking that failed.
    insert into public.promo_redemptions (promo_code_id, booking_id, profile_id, amount_discounted)
    values (promo_id, b.id, uid, promo_discount);
  end if;

  return b;
end;
$$;

comment on function public.create_booking is
  'The only booking-creation path open to customers. Prices the job, re-validates any promo code, and refuses slots outside opening hours — all server-side.';
