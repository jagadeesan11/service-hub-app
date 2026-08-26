-- Business configuration the mobile app reads at runtime, so the shop name,
-- support contacts and address can change without shipping a new build.
--
-- Singleton by construction: `id` is a boolean primary key constrained to
-- true, so a second row is impossible. That beats a settings-as-key/value
-- table here because every setting has a different type and the app wants
-- them all in one round trip.

create table public.app_settings (
  id boolean primary key default true,
  shop_name text not null default 'Nexora',
  support_email text,
  support_phone text,
  shop_address_line text,
  shop_city text,
  shop_postal_code text,
  -- Payment methods offered at checkout. Enforced server-side too (see
  -- 20260824120100) — the app hides a disabled method, but hiding a button
  -- is not a control.
  cod_enabled boolean not null default false,
  online_payment_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

create trigger set_updated_at
  before update on public.app_settings
  -- Moved to `private` by 20260823160200_harden_function_schema.
  for each row execute function private.set_updated_at();

alter table public.app_settings enable row level security;

-- Readable by anyone including anon: this is shop-front information, the same
-- as what is painted on the door. The sign-in screen needs the shop name
-- before there is a session to read it with.
create policy "app_settings_select_all" on public.app_settings
  for select using (true);

create policy "app_settings_insert_admin" on public.app_settings
  for insert with check (private.is_admin());

create policy "app_settings_update_admin" on public.app_settings
  for update using (private.is_admin()) with check (private.is_admin());

-- Deliberately no delete policy. The app assumes the row exists; removing it
-- is a schema change, not an admin action.

insert into public.app_settings (id) values (true) on conflict (id) do nothing;
