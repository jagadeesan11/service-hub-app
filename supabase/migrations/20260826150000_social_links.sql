-- Instagram and WhatsApp, configurable per shop like the rest of the
-- shop-front details.
--
-- Both are validated here rather than only in the admin form. The app hands
-- these straight to Linking.openURL, so an unchecked value is a link the shop
-- can be made to open on a customer's phone — an admin pasting the wrong
-- thing, or a compromised admin account, should not be able to point it at an
-- arbitrary scheme. The constraint is the control; the form is the courtesy.

alter table public.app_settings
  add column instagram_url text
    check (
      instagram_url is null
      or instagram_url ~ '^https://([a-z0-9-]+\.)?instagram\.com/[^\s]+$'
    ),
  -- Stored as a number, not a link: wa.me URLs are built from it, which keeps
  -- one canonical form and lets the app prefill a message later.
  add column whatsapp_number text
    check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');

comment on column public.app_settings.instagram_url is
  'Full https instagram.com profile URL. Constrained to that host because the app opens it directly.';
comment on column public.app_settings.whatsapp_number is
  'E.164 number, e.g. +919876543210. The app builds https://wa.me/<digits> from it.';
