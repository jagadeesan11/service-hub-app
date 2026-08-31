-- Removes the test-only probe from 20260830140000. It reported that the
-- trigger is attached and enabled on bookings, the function is SECURITY
-- DEFINER, RLS is on, and anon holds no grant on booking_events at all while
-- authenticated holds SELECT only. Nothing needs it after that.

drop function if exists public.temp_booking_events_probe();
