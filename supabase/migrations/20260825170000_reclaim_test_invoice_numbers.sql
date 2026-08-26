-- Hand back two invoice numbers consumed by verification runs.
--
-- MC/2026-27/0003 and 0004 were raised by throwaway bookings and deleted with
-- them, so the counter sat at 4 while the only real bills were 0001 and 0002.
--
-- Deliberately NOT self-correcting to max(existing invoice). Now that a billed
-- job can be force-deleted, a counter that follows reality would happily reuse
-- the number of a bill a customer already holds a copy of. A gap in the
-- sequence is the correct outcome of deleting a real bill; this migration only
-- undoes numbers that were never issued to anyone.

update private.invoice_counters
   set last_number = 2
 where financial_year = '2026-27'
   and last_number = 4
   and not exists (
     select 1 from public.invoices
      where number in ('MC/2026-27/0003', 'MC/2026-27/0004')
   );
