-- Core schema (service-app-build-plan.md Phase 1, Prompt 4)

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'technician', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every auth user needs a matching profiles row (bookings/customer_assets FK
-- against profiles, not auth.users) so provision one automatically on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- input_templates -------------------------------------------------------------

create table public.input_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.input_templates
  for each row execute function public.set_updated_at();

-- categories ------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  input_template_id uuid references public.input_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_input_template_id_idx on public.categories(input_template_id);

create trigger set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- services ----------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  images text[] not null default '{}',
  base_price numeric(10, 2) not null default 0,
  pricing_type text not null default 'fixed' check (pricing_type in ('fixed', 'tiered', 'per_unit')),
  duration_minutes integer,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_category_id_idx on public.services(category_id);

create trigger set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- pricing_rules -------------------------------------------------------------------

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  condition jsonb not null default '{}'::jsonb,
  price numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pricing_rules_service_id_idx on public.pricing_rules(service_id);

create trigger set_updated_at
  before update on public.pricing_rules
  for each row execute function public.set_updated_at();

-- addons -------------------------------------------------------------------------

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0,
  is_multi_select boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addons_service_id_idx on public.addons(service_id);

create trigger set_updated_at
  before update on public.addons
  for each row execute function public.set_updated_at();

-- customer_assets -------------------------------------------------------------------

create table public.customer_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_assets_user_id_idx on public.customer_assets(user_id);

create trigger set_updated_at
  before update on public.customer_assets
  for each row execute function public.set_updated_at();

-- technicians -------------------------------------------------------------------------

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  category_ids uuid[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index technicians_profile_id_idx on public.technicians(profile_id);
create index technicians_category_ids_idx on public.technicians using gin(category_ids);

create trigger set_updated_at
  before update on public.technicians
  for each row execute function public.set_updated_at();

-- bookings -------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  asset_id uuid references public.customer_assets(id) on delete set null,
  addon_ids uuid[] not null default '{}',
  scheduled_at timestamptz not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled')),
  technician_id uuid references public.technicians(id) on delete set null,
  total_price numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_user_id_idx on public.bookings(user_id);
create index bookings_service_id_idx on public.bookings(service_id);
create index bookings_technician_id_idx on public.bookings(technician_id);
create index bookings_status_idx on public.bookings(status);

create trigger set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- payments -------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10, 2) not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  razorpay_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments(booking_id);

create trigger set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();
