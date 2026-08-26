-- One more test account, from an early signup probe that never completed
-- email confirmation and so has no profile, bookings or payments attached.
-- Pattern-guarded; a no-op anywhere it does not exist.

delete from auth.users where email like 'trigger-probe-%@mailinator.com';
