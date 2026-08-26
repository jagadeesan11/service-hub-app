-- Keep the schema's own documentation honest after adding the motorcycle icon.
--
-- These are comments, not constraints: the valid keys live in
-- scripts/service-icons.mjs and the admin offers them as a picker, so an
-- unknown value renders a lettered fallback rather than breaking. But a
-- comment that lists the set and then goes stale is worse than none.

comment on column public.services.icon is
  'Key into the app''s bundled icon set (car, bike, ppf, ceramic, accessories, tyre, wash). Source of truth: scripts/service-icons.mjs. Null renders a lettered fallback.';

comment on column public.categories.icon is
  'Key into the app''s bundled icon set. Source of truth: scripts/service-icons.mjs. Null renders a lettered fallback.';
