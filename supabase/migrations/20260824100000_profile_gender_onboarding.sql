-- Signup / onboarding fields.
--
-- `gender` is optional and includes a "prefer not to say" value — it is
-- demographic data the app does not require to deliver a service, so nobody
-- should be forced to supply it.
--
-- STORE DISCLOSURE: gender is declarable personal info on both stores
-- (Google Play "Personal info", Apple "Contact Info / Other Data"). Adding it
-- widens the disclosure surface — see the launch checklist.
--
-- `onboarded_at` records that the customer has been through the profile step,
-- so the app can tell "skipped it deliberately" apart from "never saw it" and
-- avoid nagging on every launch.

alter table public.profiles
  add column gender text
    check (gender in ('female', 'male', 'other', 'undisclosed')),
  add column onboarded_at timestamptz;

comment on column public.profiles.gender is
  'Optional self-declared demographic. Never required to book a service.';
