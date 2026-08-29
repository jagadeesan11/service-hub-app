-- Hand back MC/2026-27/0009, consumed while verifying that a bill with a promo
-- code prints a line for it and still sums to its own total.
--
-- 0006, 0007 and 0008 are real bills for real jobs and are left alone; the
-- counter had legitimately reached 8 before the test ran. Guarded so it only
-- steps back if 0009 is genuinely unissued — a gap left by deleting a real
-- bill is correct and must not be reused.

update private.invoice_counters
   set last_number = 8
 where financial_year = '2026-27'
   and last_number = 9
   and not exists (
     select 1 from public.invoices where number = 'MC/2026-27/0009'
   );
