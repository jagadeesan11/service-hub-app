-- `revoke all ... from public` in 20260824120100 did not actually take EXECUTE
-- away from anon: Supabase grants new public-schema functions to anon and
-- authenticated directly, and a direct grant survives a revoke from PUBLIC.
-- A signed-out caller could therefore reach the function body. It refused them
-- (auth.uid() is null, so the ownership check raises), but a security-definer
-- function that mutates bookings should not be reachable without a session at
-- all -- the error message alone tells an anonymous prober whether COD is on.

revoke execute on function public.choose_cash_on_delivery(uuid) from anon;
