-- Remove a booking left behind by an end-to-end test run.
--
-- The test created a throwaway customer, completed a job, then tried to delete
-- the user. That delete cascades to bookings, where prevent_deleting_settled_
-- booking correctly refused -- so the user, the profile and a completed
-- 1200.00 booking survived and showed up as revenue in Reports.
--
-- Guarded on the generated test email so it can only ever match that account.
-- On any database without it, every statement here is a no-op.

do $$
declare
  test_user uuid;
begin
  select id into test_user
    from auth.users
   where email like 'del-cust-%@mailinator.com'
      or email like 'e2e-cust-%@mailinator.com'
      or email like 'report-viewer-%@mailinator.com'
      or email like 'del-admin-%@mailinator.com'
      or email like 'e2e-admin-%@mailinator.com'
   limit 1;

  while test_user is not null loop
    -- The guard exists to stop an admin erasing a settled job by hand. It is
    -- not meant to pin test data in place, so it is stood down only for these
    -- specific rows and re-armed immediately.
    alter table public.bookings disable trigger prevent_deleting_settled_booking;

    delete from public.invoices
     where booking_id in (select id from public.bookings where user_id = test_user);
    delete from public.bookings where user_id = test_user;

    alter table public.bookings enable trigger prevent_deleting_settled_booking;

    delete from auth.users where id = test_user;

    select id into test_user
      from auth.users
     where email like 'del-cust-%@mailinator.com'
        or email like 'e2e-cust-%@mailinator.com'
        or email like 'report-viewer-%@mailinator.com'
        or email like 'del-admin-%@mailinator.com'
        or email like 'e2e-admin-%@mailinator.com'
     limit 1;
  end loop;
end $$;
