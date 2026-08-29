-- The bill has to show the promo code too.
--
-- raise_invoice_on_completion was written in 20260829090000, before promo
-- codes existed. It totals net_price — which since 20260829110000 subtracts
-- promo_discount_amount as well — but only ever printed a line for the admin
-- discount. So a booking with a customer-applied code produced a bill whose
-- lines did not sum to its own total: service at full price, no promo line,
-- and a total that was mysteriously lower.
--
-- Wrong in the one place a customer checks the arithmetic, so this adds the
-- missing line and names the code that produced it.

create or replace function private.raise_invoice_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.services%rowtype;
  cfg public.app_settings%rowtype;
  p public.profiles%rowtype;
  promo_code text;
  addon_lines jsonb := '[]'::jsonb;
  addon_total numeric(10, 2) := 0;
  service_amount numeric(10, 2);
  items jsonb;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  if exists (select 1 from public.invoices where booking_id = new.id) then
    return new;
  end if;

  select * into s from public.services where id = new.service_id;
  select * into cfg from public.app_settings where id;
  select * into p from public.profiles where id = new.user_id;

  select coalesce(jsonb_agg(jsonb_build_object('description', a.name, 'amount', a.price)), '[]'::jsonb),
         coalesce(sum(a.price), 0)
    into addon_lines, addon_total
    from public.addons a
   where a.id = any(new.addon_ids);

  -- The booking's total is what was agreed and is authoritative. The service
  -- line is the remainder after add-ons, so the printed lines always sum to
  -- the amount actually charged even if an add-on's price changed since.
  service_amount := new.total_price - addon_total;

  if service_amount < 0 then
    -- Add-on prices moved enough to make the split nonsense. One honest line
    -- beats a breakdown that implies a discount nobody gave.
    items := jsonb_build_array(
      jsonb_build_object('description', coalesce(s.name, 'Service'), 'amount', new.total_price)
    );
  else
    items := jsonb_build_array(
      jsonb_build_object('description', coalesce(s.name, 'Service'), 'amount', service_amount)
    ) || addon_lines;
  end if;

  -- The customer's own promo code, named so the bill explains itself. Read
  -- from the code table rather than stored on the booking, but falls back to a
  -- generic label if the code was deleted after the job.
  if new.promo_discount_amount > 0 then
    select code into promo_code from public.promo_codes where id = new.promo_code_id;
    items := items || jsonb_build_array(jsonb_build_object(
      'description', coalesce('Promo code ' || promo_code, 'Promo code'),
      'amount', -new.promo_discount_amount
    ));
  end if;

  -- The shop's own discount, if one was granted.
  if new.discount_amount > 0 then
    items := items || jsonb_build_array(jsonb_build_object(
      'description', coalesce(nullif(trim(new.discount_reason), ''), 'Discount'),
      'amount', -new.discount_amount
    ));
  end if;

  insert into public.invoices (booking_id, number, line_items, total, payment_method, seller, buyer)
  values (
    new.id,
    private.next_invoice_number(now()),
    items,
    new.net_price,
    new.payment_method,
    jsonb_build_object(
      'name', coalesce(cfg.shop_name, 'Moto Ceramic'),
      'address_line', cfg.shop_address_line,
      'city', cfg.shop_city,
      'postal_code', cfg.shop_postal_code,
      'phone', cfg.support_phone,
      'email', cfg.support_email
    ),
    jsonb_build_object(
      'name', coalesce(new.contact_name, p.name),
      'phone', coalesce(new.contact_phone, p.phone),
      'address_line', coalesce(new.service_address, p.address_line),
      'city', coalesce(new.service_city, p.city),
      'postal_code', coalesce(new.service_postal_code, p.postal_code)
    )
  );

  return new;
end;
$$;
