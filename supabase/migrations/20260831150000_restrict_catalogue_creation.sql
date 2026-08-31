-- Only a full admin may add a category or a service.
--
-- `private.is_admin()` answers true for 'admin' and 'shop_owner' alike, which
-- is right for running a shop — taking a service off the menu, pricing it,
-- assigning work. Deciding what the business *sells* is a different question,
-- and it is the one that shapes every shop on the platform.
--
-- Only the INSERT policies move. A shop owner keeps update and delete: they
-- still need to correct a price or retire a service, and taking that away
-- would make the shop-floor app read-only for the person running the shop.

create or replace function private.is_full_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

comment on function private.is_full_admin is
  'True only for role = admin. Narrower than is_admin(), which also counts shop owners.';

-- `with check` rather than `using`: an INSERT policy has no existing row to
-- test, only the one being written.
alter policy "categories_admin_insert" on public.categories
  with check (private.is_full_admin());

alter policy "services_admin_insert" on public.services
  with check (private.is_full_admin());
