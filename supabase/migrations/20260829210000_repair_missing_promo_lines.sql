-- Restore promo lines missing from bills raised before 20260829150000.
--
-- raise_invoice_on_completion did not print a line for a customer's promo code
-- until that migration. Any bill raised in the window between promo codes
-- going live and the fix landing has a correct total (net_price) but printed
-- lines that sum to the gross — so the bill visibly does not add up, which is
-- the one thing a customer checks.
--
-- MC/2026-27/0008 is the known case: lines 98,500, total 97,000, against a
-- booking carrying a 1,500 promo discount.
--
-- This is restorative, not a rewrite. The total is not touched; the line that
-- explains it is put back, exactly as the current trigger would have written
-- it. Bills are otherwise frozen on purpose, so the guard below is deliberately
-- narrow: only bills that genuinely fail to reconcile, only where the booking
-- really carries a promo discount, and only where no promo line exists already.

update public.invoices as i
   set line_items = i.line_items || jsonb_build_array(jsonb_build_object(
         'description', coalesce('Promo code ' || pc.code, 'Promo code'),
         'amount', -b.promo_discount_amount
       ))
  from public.bookings b
  left join public.promo_codes pc on pc.id = b.promo_code_id
 where i.booking_id = b.id
   and b.promo_discount_amount > 0
   -- Only where the printed lines actually disagree with the total.
   and (
     select coalesce(sum((item ->> 'amount')::numeric), 0)
       from jsonb_array_elements(i.line_items) as item
   ) <> i.total
   -- And only where the promo is the whole of the discrepancy, so this can
   -- never paper over some other arithmetic problem.
   and (
     select coalesce(sum((item ->> 'amount')::numeric), 0)
       from jsonb_array_elements(i.line_items) as item
   ) - b.promo_discount_amount = i.total
   -- Never twice.
   and not exists (
     select 1 from jsonb_array_elements(i.line_items) as item
      where item ->> 'description' like 'Promo code%'
   );
