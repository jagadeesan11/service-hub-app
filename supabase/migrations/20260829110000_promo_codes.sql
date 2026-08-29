-- Promo codes: a configurable discount engine.
--
-- Targeting is by category or service, and categories are what a vertical is
-- in this schema — so the same engine serves car care, bike care and anything
-- added later with no per-vertical code.
--
-- Everything here runs server-side for the same reason booking prices moved
-- there in 20260829100000: a discount the customer applies is meaningless if
-- the customer also sets the amount it applies to.

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,

  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  -- Caps a percentage: "20% off, up to 2000". Meaningless for a fixed amount.
  max_discount_amount numeric(10, 2) check (max_discount_amount is null or max_discount_amount > 0),
  min_order_value numeric(10, 2) not null default 0 check (min_order_value >= 0),

  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,

  -- null means unlimited, for both.
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  per_customer_limit integer default 1 check (per_customer_limit is null or per_customer_limit > 0),

  applies_to text not null default 'all' check (applies_to in ('all', 'category', 'service')),
  category_ids uuid[] not null default '{}',
  service_ids uuid[] not null default '{}',

  -- Whether the app lists it. A code can be live but unadvertised, which is
  -- how you run a targeted campaign without putting it on the home screen.
  is_public boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promo_codes_percentage_range
    check (discount_type <> 'percentage' or discount_value <= 100),
  constraint promo_codes_window_ordered
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint promo_codes_code_shape
    check (char_length(code) between 3 and 32 and code ~ '^[A-Za-z0-9_-]+$')
);

-- Codes are matched case-insensitively: a customer typing "save20" off a
-- poster that reads SAVE20 should not be told their code is invalid.
create unique index promo_codes_code_key on public.promo_codes (upper(code));
create index promo_codes_active_idx on public.promo_codes (is_active, ends_at);

create trigger set_updated_at
  before update on public.promo_codes
  for each row execute function private.set_updated_at();

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  -- One redemption per booking, enforced rather than assumed.
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount_discounted numeric(10, 2) not null,
  -- Set when the booking is cancelled. The row survives for reporting, but a
  -- released redemption no longer counts against either limit — otherwise a
  -- cancellation would burn a one-per-customer code, and anyone could exhaust
  -- a capped code by booking and cancelling.
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index promo_redemptions_code_idx on public.promo_redemptions (promo_code_id, released_at);
create index promo_redemptions_profile_idx on public.promo_redemptions (profile_id, promo_code_id);

-- bookings ---------------------------------------------------------------------

alter table public.bookings
  add column promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column promo_discount_amount numeric(10, 2) not null default 0
    check (promo_discount_amount >= 0);

-- Both discounts come off the gross and the result floors at zero, so the two
-- can coexist without either needing to know about the other.
alter table public.bookings drop column net_price;
alter table public.bookings
  add column net_price numeric(10, 2)
    generated always as (
      greatest(total_price - discount_amount - promo_discount_amount, 0)
    ) stored;

comment on column public.bookings.promo_discount_amount is
  'Frozen at booking time. The code may later change or expire; what was granted does not.';

-- evaluation -------------------------------------------------------------------

-- The single place a code is judged. Called by validate_promo_code for the
-- customer's preview and again by create_booking for the real thing, so the
-- quoted discount and the charged discount cannot disagree.
create or replace function private.evaluate_promo_code(
  p_code text,
  p_profile_id uuid,
  p_service_id uuid,
  p_gross numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.promo_codes%rowtype;
  service_category uuid;
  used_total integer;
  used_by_customer integer;
  discount numeric(10, 2);
  fail jsonb;
begin
  if p_code is null or trim(p_code) = '' then
    return jsonb_build_object('valid', false, 'reason', 'Enter a code.');
  end if;

  select * into c from public.promo_codes where upper(code) = upper(trim(p_code));

  -- Every rejection below says the same thing for an unknown code as for a
  -- disabled one. Distinguishing them would turn this into an oracle for
  -- discovering codes that exist but are not yet live.
  fail := jsonb_build_object('valid', false, 'reason', 'That code is not valid.');

  if not found then return fail; end if;
  if not c.is_active then return fail; end if;
  if c.starts_at is not null and now() < c.starts_at then return fail; end if;

  if c.ends_at is not null and now() > c.ends_at then
    -- Expiry is worth naming: the customer probably had a valid code and left
    -- it too long, and "not valid" would read as though they mistyped it.
    return jsonb_build_object('valid', false, 'reason', 'That code has expired.');
  end if;

  -- Tested against the gross, before any admin discount on the booking.
  if p_gross < c.min_order_value then
    return jsonb_build_object(
      'valid', false,
      'reason', 'This code needs a booking of at least ' || to_char(c.min_order_value, 'FM999999') || '.'
    );
  end if;

  if c.applies_to = 'service' then
    if not (p_service_id = any(c.service_ids)) then
      return jsonb_build_object('valid', false, 'reason', 'That code does not apply to this service.');
    end if;
  elsif c.applies_to = 'category' then
    select category_id into service_category from public.services where id = p_service_id;
    if service_category is null or not (service_category = any(c.category_ids)) then
      return jsonb_build_object('valid', false, 'reason', 'That code does not apply to this service.');
    end if;
  end if;

  if c.max_redemptions is not null then
    select count(*) into used_total
      from public.promo_redemptions
     where promo_code_id = c.id and released_at is null;
    if used_total >= c.max_redemptions then
      return jsonb_build_object('valid', false, 'reason', 'This code has been fully claimed.');
    end if;
  end if;

  if c.per_customer_limit is not null and p_profile_id is not null then
    select count(*) into used_by_customer
      from public.promo_redemptions
     where promo_code_id = c.id and profile_id = p_profile_id and released_at is null;
    if used_by_customer >= c.per_customer_limit then
      return jsonb_build_object('valid', false, 'reason', 'You have already used this code.');
    end if;
  end if;

  if c.discount_type = 'percentage' then
    discount := round(p_gross * c.discount_value / 100, 2);
    if c.max_discount_amount is not null then
      discount := least(discount, c.max_discount_amount);
    end if;
  else
    discount := c.discount_value;
  end if;

  -- Never more than the job is worth; the rest is a refund, not a discount.
  discount := least(discount, p_gross);

  return jsonb_build_object(
    'valid', true,
    'promo_code_id', c.id,
    'code', c.code,
    'description', c.description,
    'discount_amount', discount,
    'net_price', p_gross - discount
  );
end;
$$;

-- What the Apply button calls.
create or replace function public.validate_promo_code(
  p_code text,
  p_service_id uuid,
  p_asset_id uuid default null,
  p_addon_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := (select auth.uid());
  attrs jsonb := '{}'::jsonb;
  owner uuid;
  gross numeric(10, 2);
begin
  if uid is null then
    raise exception 'You need to be signed in' using errcode = 'insufficient_privilege';
  end if;

  if p_asset_id is not null then
    select attributes, user_id into attrs, owner
      from public.customer_assets where id = p_asset_id;
    if owner is distinct from uid and not private.is_admin() then
      raise exception 'Not your vehicle' using errcode = 'insufficient_privilege';
    end if;
  end if;

  gross := private.compute_booking_price(p_service_id, coalesce(attrs, '{}'::jsonb), p_addon_ids);

  return private.evaluate_promo_code(p_code, uid, p_service_id, gross)
         || jsonb_build_object('gross', gross);
end;
$$;

revoke all on function public.validate_promo_code(text, uuid, uuid, uuid[]) from public;
revoke execute on function public.validate_promo_code(text, uuid, uuid, uuid[]) from anon;
grant execute on function public.validate_promo_code(text, uuid, uuid, uuid[]) to authenticated;

-- release on cancellation --------------------------------------------------------

create or replace function private.release_promo_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.promo_redemptions
       set released_at = now()
     where booking_id = new.id and released_at is null;
  end if;
  return new;
end;
$$;

create trigger release_promo_on_cancel
  after update on public.bookings
  for each row execute function private.release_promo_on_cancel();

-- access -------------------------------------------------------------------------

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- Customers may read the codes being advertised, and only those: the columns
-- are harmless, and the app has to list them. Unlisted codes stay invisible,
-- which is what makes a targeted campaign targeted.
create policy promo_codes_select_public
  on public.promo_codes for select
  using (
    private.is_admin()
    or (
      is_public
      and is_active
      and (starts_at is null or now() >= starts_at)
      and (ends_at is null or now() <= ends_at)
    )
  );

create policy promo_codes_write_admin
  on public.promo_codes for all
  using (private.is_admin()) with check (private.is_admin());

-- Redemptions are written by create_booking (security definer) and read for
-- reporting. A customer can see their own; nobody else's.
create policy promo_redemptions_select_own
  on public.promo_redemptions for select
  using (profile_id = (select auth.uid()) or private.is_admin());

create policy promo_redemptions_write_admin
  on public.promo_redemptions for all
  using (private.is_admin()) with check (private.is_admin());

-- The blanket revoke in 20260826120000 already stripped anon; this keeps
-- authenticated from writing either table directly.
revoke insert, update, delete on public.promo_codes from authenticated;
revoke insert, update, delete on public.promo_redemptions from authenticated;
grant select on public.promo_codes to authenticated, anon;
grant select on public.promo_redemptions to authenticated;
