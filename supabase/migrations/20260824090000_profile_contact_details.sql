-- Customer contact + service address on the profile, for the mobile Profile
-- tab and for technicians who need to know where the job is.
--
-- NOTE FOR STORE DISCLOSURES: this is the first place the app stores a
-- customer address. Both the Apple App Privacy questionnaire and Google's
-- Data safety form must now declare a coarse/user-provided address under
-- "Location" — previously the app collected none. See the launch checklist.
--
-- This is a self-entered postal address, not device GPS: the app requests no
-- location permission and reads no device location.

alter table public.profiles
  add column email text,
  add column address_line text,
  add column city text,
  add column postal_code text;

comment on column public.profiles.address_line is
  'Self-entered service address. Not device location — no location permission is requested.';
