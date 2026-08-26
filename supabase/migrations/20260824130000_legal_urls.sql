-- Where the published legal documents live.
--
-- Both stores require a reachable privacy policy URL before they will accept a
-- submission, and the URL is not knowable at build time -- it depends on where
-- the business chooses to host it. Keeping it in app_settings means the in-app
-- link and the store listing can be pointed at the same place without a
-- release, and the app can honestly show "not published yet" while it is null.

alter table public.app_settings
  add column privacy_url text,
  add column terms_url text;

comment on column public.app_settings.privacy_url is
  'Public URL of the privacy policy. Must be reachable without a login -- store reviewers open it anonymously.';
