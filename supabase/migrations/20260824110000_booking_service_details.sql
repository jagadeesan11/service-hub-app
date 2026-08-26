-- Per-booking service address, contact and pickup preference.
--
-- Deliberately snapshotted onto the booking rather than read from profiles at
-- display time: a customer who moves house, or books on behalf of someone
-- else, must not retroactively rewrite where a past job happened or who the
-- technician was told to call. The profile supplies the default; the booking
-- records what was actually agreed.

alter table public.bookings
  add column contact_name text,
  add column contact_phone text,
  add column service_address text,
  add column service_city text,
  add column service_postal_code text,
  add column needs_pickup boolean not null default false,
  add column pickup_notes text;

comment on column public.bookings.service_address is
  'Snapshot of the address agreed for this booking. Not a live reference to profiles.';
comment on column public.bookings.needs_pickup is
  'Customer wants the vehicle collected rather than the technician attending on site.';
