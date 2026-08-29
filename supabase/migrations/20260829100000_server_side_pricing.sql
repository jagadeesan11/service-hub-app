-- The server decides what a booking costs.
--
-- Until now total_price arrived from the app and was never checked, so a
-- ten-thousand-rupee job could be inserted at one rupee and the Razorpay order
-- built from it. This ports the pricing rules out of mobile/src/lib/pricing.ts
-- into the database, routes booking creation through an RPC that applies them,
-- and takes away the direct INSERT that made the client authoritative.
--
-- It is also the prerequisite for promo codes: a discount the customer applies
-- is meaningless while the customer sets the price it applies to.

-- pricing ----------------------------------------------------------------------

create or replace function private.compute_booking_price(
  p_service_id uuid,
  p_attributes jsonb,
  p_addon_ids uuid[]
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  s public.services%rowtype;
  attrs jsonb := coalesce(p_attributes, '{}'::jsonb);
  service_price numeric(10, 2);
  addon_total numeric(10, 2);
  quantity numeric;
begin
  select * into s from public.services where id = p_service_id;
  if not found then
    raise exception 'That service no longer exists' using errcode = 'no_data_found';
  end if;

  if s.pricing_type = 'tiered' then
    -- `condition <@ attrs` is jsonb containment: every key/value in the rule
    -- must appear in the vehicle's attributes. That is exactly what the app's
    -- Object.entries(...).every(...) did.
    --
    -- Ordered most-specific-first rather than taking an arbitrary first match,
    -- so a general rule can never shadow a more precise one. The app picked
    -- whichever row PostgREST happened to return first, which was luck.
    select r.price into service_price
      from public.pricing_rules r
     where r.service_id = s.id
       and r.condition <@ attrs
     order by jsonb_array_length(
                coalesce(jsonb_path_query_array(r.condition, '$.keyvalue()'), '[]'::jsonb)
              ) desc,
              r.id
     limit 1;

    service_price := coalesce(service_price, s.base_price);

  elsif s.pricing_type = 'per_unit' then
    -- No quantity column exists anywhere, so the unit count is read from the
    -- vehicle's own attributes, defaulting to one. Mirrors the app exactly.
    quantity := coalesce(nullif(attrs ->> 'quantity', '')::numeric, 1);
    if quantity < 1 then
      quantity := 1;
    end if;
    service_price := s.base_price * quantity;

  else
    service_price := s.base_price;
  end if;

  -- Scoped to this service's own add-ons. Without the service_id check a
  -- caller could pass the id of a cheaper add-on belonging to another service.
  select coalesce(sum(a.price), 0) into addon_total
    from public.addons a
   where a.id = any(coalesce(p_addon_ids, '{}'::uuid[]))
     and a.service_id = s.id;

  return round(service_price + addon_total, 2);
end;
$$;

-- What the customer is shown before they commit. The confirm screen calls this
-- rather than pricing locally, so the number on screen and the number charged
-- come from one place and cannot drift apart.
create or replace function public.quote_booking_price(
  p_service_id uuid,
  p_asset_id uuid default null,
  p_addon_ids uuid[] default '{}'::uuid[]
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  attrs jsonb := '{}'::jsonb;
  owner uuid;
begin
  if p_asset_id is not null then
    select attributes, user_id into attrs, owner
      from public.customer_assets where id = p_asset_id;

    -- security definer bypasses RLS, so ownership is checked by hand.
    if owner is distinct from (select auth.uid()) and not private.is_admin() then
      raise exception 'Not your vehicle' using errcode = 'insufficient_privilege';
    end if;
  end if;

  return private.compute_booking_price(p_service_id, coalesce(attrs, '{}'::jsonb), p_addon_ids);
end;
$$;

revoke all on function public.quote_booking_price(uuid, uuid, uuid[]) from public;
revoke execute on function public.quote_booking_price(uuid, uuid, uuid[]) from anon;
grant execute on function public.quote_booking_price(uuid, uuid, uuid[]) to authenticated;

-- booking creation ---------------------------------------------------------------

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
  p_pickup_notes text default null
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
  b public.bookings%rowtype;
begin
  if uid is null then
    raise exception 'You need to be signed in to book' using errcode = 'insufficient_privilege';
  end if;

  if p_scheduled_at is null or p_scheduled_at < now() then
    raise exception 'Pick a time in the future' using errcode = 'check_violation';
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

  -- user_id is taken from the session, never from an argument: passing it in
  -- would let a caller create bookings against someone else's account.
  --
  -- status, payment_method and technician_id are deliberately not set here.
  -- enforce_booking_insert_integrity forces them, and it also refuses the
  -- insert outright when online booking is switched off.
  insert into public.bookings (
    user_id, service_id, asset_id, addon_ids, scheduled_at, total_price,
    contact_name, contact_phone, service_address, service_city,
    service_postal_code, needs_pickup, pickup_notes
  )
  values (
    uid, p_service_id, p_asset_id, coalesce(p_addon_ids, '{}'::uuid[]), p_scheduled_at, price,
    p_contact_name, p_contact_phone, p_service_address, p_service_city,
    p_service_postal_code, coalesce(p_needs_pickup, false), nullif(trim(coalesce(p_pickup_notes, '')), '')
  )
  returning * into b;

  return b;
end;
$$;

revoke all on function public.create_booking(
  uuid, timestamptz, uuid, uuid[], text, text, text, text, text, boolean, text
) from public;
revoke execute on function public.create_booking(
  uuid, timestamptz, uuid, uuid[], text, text, text, text, text, boolean, text
) from anon;
grant execute on function public.create_booking(
  uuid, timestamptz, uuid, uuid[], text, text, text, text, text, boolean, text
) to authenticated;

-- close the direct path ----------------------------------------------------------

-- The RLS policy stays as it is; this removes the grant underneath it, so the
-- only way a signed-in customer can create a booking is through the RPC above.
-- service_role keeps its INSERT: Edge Functions and admin tooling are trusted
-- server code, and anon lost every write grant in 20260826120000.
revoke insert on public.bookings from authenticated;

comment on function public.create_booking is
  'The only booking-creation path open to customers. Prices the job server-side; the caller cannot set total_price or user_id.';
