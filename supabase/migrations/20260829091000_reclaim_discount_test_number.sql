-- Hand back one invoice number consumed by the booking-discount verification.
--
-- MC/2026-27/0007 was raised by a throwaway booking, checked, and deleted with
-- it. The counter sat at 7 while the only real bill is 0006, so the next real
-- job would have been numbered 0008 and left a gap at 0007.
--
-- Guarded the same way as 20260825170000: only steps back if that number is
-- genuinely unissued, and deliberately not self-correcting to max(invoices) —
-- a counter that followed reality would reuse the number of a bill a customer
-- already holds if a real one were ever deleted.

update private.invoice_counters
   set last_number = 6
 where financial_year = '2026-27'
   and last_number = 7
   and not exists (
     select 1 from public.invoices where number = 'MC/2026-27/0007'
   );
