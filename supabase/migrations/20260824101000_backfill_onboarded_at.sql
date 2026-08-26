-- Backfill for accounts that predate the onboarding step.
--
-- Anyone who already supplied a name has effectively completed the profile
-- step, so treat them as onboarded rather than interrupting them with a form
-- asking for details they have already given.
--
-- Uses created_at rather than now() so the timestamp doesn't imply the
-- customer filled the form at deploy time.

update public.profiles
set onboarded_at = created_at
where onboarded_at is null
  and name is not null
  and btrim(name) <> '';
