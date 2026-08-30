-- Opening hours and closed days.
--
-- Until now the app generated slots from a constant: 9 to 6, seven days a
-- week, forever. A shop that closes on Sunday or shuts for Diwali had no way
-- to say so, and a customer could book a slot nobody would be there for.
--
-- Enforced in create_booking as well as shown in the picker. A rule the client
-- merely draws is not a rule — the same reason booking prices moved to the
-- server in 20260829100000.

create table public.business_hours (
  -- 0 = Sunday, matching both Postgres extract(dow) and JavaScript getDay(),
  -- so no translation is needed at either end.
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time not null default '09:00',
  closes_at time not null default '18:00',
  updated_at timestamptz not null default now(),
  constraint business_hours_ordered check (closes_at > opens_at)
);

create trigger set_updated_at
  before update on public.business_hours
  for each row execute function private.set_updated_at();

-- Seeded for every day so the table is always complete: a missing row would
-- have to mean either "open" or "closed", and both readings are wrong half
-- the time. Sunday starts closed, which is the common case here.
insert into public.business_hours (weekday, is_open, opens_at, closes_at) values
  (0, false, '10:00', '14:00'),
  (1, true,  '09:00', '19:00'),
  (2, true,  '09:00', '19:00'),
  (3, true,  '09:00', '19:00'),
  (4, true,  '09:00', '19:00'),
  (5, true,  '09:00', '19:00'),
  (6, true,  '09:00', '16:00')
on conflict (weekday) do nothing;

create table public.shop_closures (
  id uuid primary key default gen_random_uuid(),
  -- One row per date, so blocking the same day twice is impossible rather
  -- than merely discouraged.
  closed_on date not null unique,
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now()
);

create index shop_closures_date_idx on public.shop_closures (closed_on);

-- access ------------------------------------------------------------------------

alter table public.business_hours enable row level security;
alter table public.shop_closures enable row level security;

-- Readable by anyone, including anon: these are shop-front facts, the same as
-- the address on the door, and the app needs them to draw a slot picker before
-- anyone signs in.
create policy business_hours_select_all on public.business_hours for select using (true);
create policy shop_closures_select_all on public.shop_closures for select using (true);

create policy business_hours_write_admin on public.business_hours
  for all using (private.is_admin()) with check (private.is_admin());
create policy shop_closures_write_admin on public.shop_closures
  for all using (private.is_admin()) with check (private.is_admin());

-- Grants and RLS are two separate layers: the policies above are the control,
-- so `authenticated` needs the grant underneath them or an admin is refused
-- before any policy is consulted. anon keeps SELECT only.
grant select on public.business_hours to authenticated, anon;
grant select on public.shop_closures to authenticated, anon;
grant insert, update, delete on public.business_hours to authenticated;
grant insert, update, delete on public.shop_closures to authenticated;
revoke insert, update, delete on public.business_hours from anon;
revoke insert, update, delete on public.shop_closures from anon;

-- enforcement --------------------------------------------------------------------

/**
 * Whether the shop is actually open at a given moment.
 *
 * A closed day beats opening hours: a closure is the shop saying "not that
 * day" regardless of what the weekly pattern says.
 */
create or replace function private.is_open_at(p_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  h public.business_hours%rowtype;
  local_date date := (p_at at time zone 'Asia/Kolkata')::date;
  local_time time := (p_at at time zone 'Asia/Kolkata')::time;
begin
  if exists (select 1 from public.shop_closures where closed_on = local_date) then
    return false;
  end if;

  select * into h from public.business_hours
   where weekday = extract(dow from local_date)::smallint;

  if not found or not h.is_open then
    return false;
  end if;

  -- The slot must start inside the window. A job running past closing is the
  -- shop's business; a job starting after closing is nobody's.
  return local_time >= h.opens_at and local_time < h.closes_at;
end;
$$;

comment on function private.is_open_at is
  'Times are read in Asia/Kolkata: opening hours are a wall-clock fact about a physical shop, not a UTC one.';
