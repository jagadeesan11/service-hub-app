-- RLS performance fixes (Phase 1 follow-up), from `supabase db advisors --type performance`:
--   - auth_rls_initplan: `auth.uid()` referenced directly in a policy is
--     re-evaluated per row; wrapping it as `(select auth.uid())` lets
--     Postgres evaluate it once per query instead. (Custom STABLE helper
--     functions like private.is_admin() take no row-varying arguments, so
--     the planner already hoists those — only literal auth.uid() calls
--     were flagged.)
--   - multiple_permissive_policies: several tables had both a `for all`
--     admin policy and a separate public/self read policy, so every SELECT
--     paid for two permissive policy evaluations. Splitting the admin
--     policy into insert/update/delete (dropping its redundant SELECT
--     coverage, since the read policy already covers admins) leaves one
--     permissive SELECT policy per table.

-- profiles ----------------------------------------------------------------

alter policy "profiles_select_own_or_admin" on public.profiles
  using (id = (select auth.uid()) or private.is_admin());

alter policy "profiles_insert_own" on public.profiles
  with check ((id = (select auth.uid()) and role = 'customer') or private.is_admin());

alter policy "profiles_update_own_or_admin" on public.profiles
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

-- catalog tables: split "admin write" into insert/update/delete so the
-- public read policy is the only one left covering SELECT --------------

drop policy "categories_admin_write" on public.categories;
create policy "categories_admin_insert" on public.categories for insert with check (private.is_admin());
create policy "categories_admin_update" on public.categories for update using (private.is_admin()) with check (private.is_admin());
create policy "categories_admin_delete" on public.categories for delete using (private.is_admin());

drop policy "services_admin_write" on public.services;
create policy "services_admin_insert" on public.services for insert with check (private.is_admin());
create policy "services_admin_update" on public.services for update using (private.is_admin()) with check (private.is_admin());
create policy "services_admin_delete" on public.services for delete using (private.is_admin());

drop policy "addons_admin_write" on public.addons;
create policy "addons_admin_insert" on public.addons for insert with check (private.is_admin());
create policy "addons_admin_update" on public.addons for update using (private.is_admin()) with check (private.is_admin());
create policy "addons_admin_delete" on public.addons for delete using (private.is_admin());

drop policy "pricing_rules_admin_write" on public.pricing_rules;
create policy "pricing_rules_admin_insert" on public.pricing_rules for insert with check (private.is_admin());
create policy "pricing_rules_admin_update" on public.pricing_rules for update using (private.is_admin()) with check (private.is_admin());
create policy "pricing_rules_admin_delete" on public.pricing_rules for delete using (private.is_admin());

drop policy "input_templates_admin_write" on public.input_templates;
create policy "input_templates_admin_insert" on public.input_templates for insert with check (private.is_admin());
create policy "input_templates_admin_update" on public.input_templates for update using (private.is_admin()) with check (private.is_admin());
create policy "input_templates_admin_delete" on public.input_templates for delete using (private.is_admin());

-- customer_assets -----------------------------------------------------------

alter policy "customer_assets_owner" on public.customer_assets
  using (user_id = (select auth.uid()) or private.is_admin())
  with check (user_id = (select auth.uid()) or private.is_admin());

-- technicians: merge admin + self read into one SELECT policy, split the
-- rest into insert/update/delete ------------------------------------------

drop policy "technicians_admin_all" on public.technicians;
drop policy "technicians_self_select" on public.technicians;

create policy "technicians_select" on public.technicians
  for select using (private.is_admin() or profile_id = (select auth.uid()));
create policy "technicians_admin_insert" on public.technicians for insert with check (private.is_admin());
create policy "technicians_admin_update" on public.technicians for update using (private.is_admin()) with check (private.is_admin());
create policy "technicians_admin_delete" on public.technicians for delete using (private.is_admin());

-- bookings ------------------------------------------------------------------

alter policy "bookings_select" on public.bookings
  using (
    user_id = (select auth.uid())
    or private.is_admin()
    or technician_id = private.technician_id_for_current_user()
  );

alter policy "bookings_insert_own" on public.bookings
  with check (user_id = (select auth.uid()) or private.is_admin());

alter policy "bookings_update" on public.bookings
  using (
    user_id = (select auth.uid())
    or private.is_admin()
    or technician_id = private.technician_id_for_current_user()
  )
  with check (
    user_id = (select auth.uid())
    or private.is_admin()
    or technician_id = private.technician_id_for_current_user()
  );

-- payments: split select from insert/update/delete ---------------------------

drop policy "payments_owner_select" on public.payments;
drop policy "payments_owner_write" on public.payments;

create policy "payments_select" on public.payments
  for select using (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = (select auth.uid())
    )
  );

create policy "payments_insert" on public.payments
  for insert with check (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = (select auth.uid())
    )
  );

create policy "payments_update" on public.payments
  for update using (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = (select auth.uid())
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = (select auth.uid())
    )
  );

create policy "payments_delete" on public.payments
  for delete using (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.user_id = (select auth.uid())
    )
  );
