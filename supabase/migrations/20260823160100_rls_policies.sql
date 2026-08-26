-- Row Level Security (service-app-build-plan.md Phase 1, Prompt 5)

-- security definer helpers avoid infinite recursion when a policy on
-- `profiles` would otherwise need to query `profiles` (with RLS applied)
-- to determine the caller's role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.technician_id_for_current_user()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.technicians where profile_id = auth.uid();
$$;

-- profiles --------------------------------------------------------------------
-- (not explicitly listed in Prompt 5, but required so role-based checks above
-- and self-service profile access work; every table's RLS depends on this one)

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- role defaults to 'customer' via the column default and handle_new_user;
-- a self-insert may not silently grant technician/admin access.
create policy "profiles_insert_own" on public.profiles
  for insert with check ((id = auth.uid() and role = 'customer') or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- USING/WITH CHECK above only gate *which rows* are touched, not which
-- columns change, so a non-admin could otherwise UPDATE their own row and
-- set role = 'admin'. Block that here.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a profile''s role';
  end if;
  return new;
end;
$$;

create trigger prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- catalog tables: categories, services, addons, pricing_rules, input_templates
-- publicly readable, only admins can write ----------------------------------

alter table public.categories enable row level security;
create policy "categories_public_read" on public.categories for select using (true);
create policy "categories_admin_write" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.services enable row level security;
create policy "services_public_read" on public.services for select using (true);
create policy "services_admin_write" on public.services for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.addons enable row level security;
create policy "addons_public_read" on public.addons for select using (true);
create policy "addons_admin_write" on public.addons for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.pricing_rules enable row level security;
create policy "pricing_rules_public_read" on public.pricing_rules for select using (true);
create policy "pricing_rules_admin_write" on public.pricing_rules for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.input_templates enable row level security;
create policy "input_templates_public_read" on public.input_templates for select using (true);
create policy "input_templates_admin_write" on public.input_templates for all
  using (public.is_admin()) with check (public.is_admin());

-- customer_assets: customers manage their own -------------------------------

alter table public.customer_assets enable row level security;

create policy "customer_assets_owner" on public.customer_assets
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- technicians -----------------------------------------------------------------
-- (not explicitly listed in Prompt 5; admins manage the roster, a technician
-- may read their own record)

alter table public.technicians enable row level security;

create policy "technicians_admin_all" on public.technicians
  for all using (public.is_admin()) with check (public.is_admin());

create policy "technicians_self_select" on public.technicians
  for select using (profile_id = auth.uid());

-- bookings ----------------------------------------------------------------------
-- customers: full access to their own bookings
-- technicians: read bookings assigned to them, update status only (enforced
-- below by trigger, since RLS policies can't restrict individual columns)

alter table public.bookings enable row level security;

create policy "bookings_select" on public.bookings
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or technician_id = public.technician_id_for_current_user()
  );

create policy "bookings_insert_own" on public.bookings
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy "bookings_update" on public.bookings
  for update using (
    user_id = auth.uid()
    or public.is_admin()
    or technician_id = public.technician_id_for_current_user()
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or technician_id = public.technician_id_for_current_user()
  );

create or replace function public.enforce_technician_status_only_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or old.user_id = auth.uid() then
    return new;
  end if;

  if old.technician_id = public.technician_id_for_current_user() then
    if new.user_id is distinct from old.user_id
      or new.service_id is distinct from old.service_id
      or new.asset_id is distinct from old.asset_id
      or new.addon_ids is distinct from old.addon_ids
      or new.scheduled_at is distinct from old.scheduled_at
      or new.technician_id is distinct from old.technician_id
      or new.total_price is distinct from old.total_price
    then
      raise exception 'Technicians may only update booking status';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_technician_status_only_update
  before update on public.bookings
  for each row execute function public.enforce_technician_status_only_update();

-- payments: owned indirectly through the parent booking ------------------------

alter table public.payments enable row level security;

create policy "payments_owner_select" on public.payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = auth.uid()
    )
  );

create policy "payments_owner_write" on public.payments
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = auth.uid()
    )
  );
