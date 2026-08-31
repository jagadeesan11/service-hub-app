-- The shop's logo, configurable like the rest of the shop-front details.
--
-- It was about to be a PNG committed into the mobile bundle. That works for
-- exactly one shop: Nexora is meant to run several, and a hard-coded
-- motoceramic-*.png in the app is a second shop's rebrand becoming an app
-- store release. Making it a setting keeps the binary generic.
--
-- Validated here and not only in the admin form, for the same reason as the
-- social links: the app hands this URL straight to an <Image>, so an
-- unchecked value is a request the shop can be made to issue from a
-- customer's device. https only, and only from this project's own storage —
-- the constraint is the control, the form is the courtesy.

alter table public.app_settings
  add column shop_logo_url text
    check (
      shop_logo_url is null
      or shop_logo_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/[^\s]+$'
    );

comment on column public.app_settings.shop_logo_url is
  'Public Storage URL of the shop logo, shown in the app. Null falls back to the shop initials.';
