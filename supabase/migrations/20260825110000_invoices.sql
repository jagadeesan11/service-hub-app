-- Bills, raised automatically when a job is marked complete.
--
-- Moto Ceramic is not GST registered, so this is a BILL OF SUPPLY: no tax
-- line, no GSTIN, and nothing anywhere that says "tax invoice". Showing a GST
-- column without registration is an offence under the CGST Act, so the absence
-- is deliberate -- if registration happens later, this needs a real rework
-- (GSTIN, SAC codes, CGST/SGST split, place of supply), not a new column.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  -- One bill per job. A second "Mark complete" must not raise a duplicate.
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  number text not null unique,
  issued_at timestamptz not null default now(),
  -- Everything the bill prints, frozen at issue. Prices and even the business
  -- name can change afterwards; a bill that silently rewrites itself is not a
  -- record of anything.
  line_items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null,
  payment_method text not null,
  seller jsonb not null default '{}'::jsonb,
  buyer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_booking_id_idx on public.invoices(booking_id);

create trigger set_updated_at
  before update on public.invoices
  for each row execute function private.set_updated_at();

-- numbering -------------------------------------------------------------------
-- Gap-free and sequential per Indian financial year (April to March), which is
-- what an accountant expects. A plain sequence would leave gaps on rollback.

create table private.invoice_counters (
  financial_year text primary key,
  last_number integer not null default 0
);

create or replace function private.next_invoice_number(at timestamptz)
returns text
language plpgsql
as $$
declare
  d date := (at at time zone 'Asia/Kolkata')::date;
  start_year int := case when extract(month from d) >= 4
                         then extract(year from d)::int
                         else extract(year from d)::int - 1 end;
  fy text := start_year || '-' || right((start_year + 1)::text, 2);
  n int;
begin
  insert into private.invoice_counters (financial_year, last_number)
  values (fy, 1)
  on conflict (financial_year)
    do update set last_number = private.invoice_counters.last_number + 1
  returning last_number into n;

  return 'MC/' || fy || '/' || lpad(n::text, 4, '0');
end;
$$;

-- issuing ---------------------------------------------------------------------

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

  insert into public.invoices (booking_id, number, line_items, total, payment_method, seller, buyer)
  values (
    new.id,
    private.next_invoice_number(now()),
    items,
    new.total_price,
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

create trigger raise_invoice_on_completion
  after update on public.bookings
  for each row execute function private.raise_invoice_on_completion();

-- access ----------------------------------------------------------------------

alter table public.invoices enable row level security;

create policy "invoices_select" on public.invoices
  for select using (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = invoices.booking_id and b.user_id = (select auth.uid())
    )
  );

-- No insert/update/delete policies at all. Bills are raised by the trigger and
-- are then a fixed record; editing one from a client is never correct.
