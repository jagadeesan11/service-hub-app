-- Give back the invoice number consumed by an end-to-end test.
--
-- A verification run completed a throwaway booking, which raised MC/2026-27/0003
-- and then deleted it during cleanup. The counter kept the increment, so the
-- next real bill would have been 0004 with 0003 missing -- exactly the gap the
-- counter table exists to avoid.
--
-- Guarded so it only touches that precise state: on any other database the
-- row either does not exist or is not at 3, and this is a no-op.

update private.invoice_counters
   set last_number = 2
 where financial_year = '2026-27'
   and last_number = 3
   and not exists (select 1 from public.invoices where number = 'MC/2026-27/0003');
