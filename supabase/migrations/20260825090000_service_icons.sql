-- Per-service icon key.
--
-- categories.icon already existed but nothing ever rendered it -- the mobile
-- app drew a tinted initial letter instead, so the admin's icon field was
-- silently dead data. Both are now read by the apps, and the admin offers a
-- fixed list rather than free text, so a typo cannot quietly produce nothing.
--
-- The value is a key into the shared artwork (scripts/service-icons.mjs), not
-- a URL: the icons ship with the app so they render offline, tint with the
-- theme, and stay sharp at any size.

alter table public.services add column icon text;

comment on column public.services.icon is
  'Key into the app''s bundled icon set (car, ppf, ceramic, accessories, tyre, wash). Null renders a lettered fallback.';

comment on column public.categories.icon is
  'Key into the app''s bundled icon set. Null renders a lettered fallback.';

-- Give the existing catalogue real artwork.
update public.services set icon = 'ppf'         where name ilike '%paint protection%' or name ilike 'PPF%';
update public.services set icon = 'ceramic'     where name ilike '%ceramic%';
update public.services set icon = 'accessories' where name ilike '%accessor%';
update public.services set icon = 'tyre'        where name ilike '%tyre%' or name ilike '%tire%';
