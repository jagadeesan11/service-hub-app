-- A shop_owner role, and a users screen to manage staff.
--
-- shop_owner carries the same access as admin. The distinction is who a person
-- is, not what they may do: the owner of the business and the person running
-- the desk both need the whole panel. A role that looks meaningful in a list
-- but grants nothing is worse than no role at all, so it is wired into
-- is_admin() rather than left decorative.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'technician', 'admin', 'shop_owner'));

comment on column public.profiles.role is
  'customer = mobile app. technician = own assigned jobs. admin / shop_owner = full admin panel.';

-- Every policy in the schema routes through this, so widening it here is the
-- single place that grants the new role its access.
create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'shop_owner')
  );
$$;

-- The last admin must not be able to demote or delete themselves into a
-- locked-out shop. Recovering from that needs direct database access.
create or replace function private.prevent_removing_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  -- Only worth checking when an admin stops being one.
  if tg_op = 'UPDATE'
     and old.role in ('admin', 'shop_owner')
     and new.role not in ('admin', 'shop_owner') then
    select count(*) into remaining
      from public.profiles
     where role in ('admin', 'shop_owner') and id <> old.id;
    if remaining = 0 then
      raise exception 'This is the only admin account. Promote someone else before changing this one.'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role in ('admin', 'shop_owner') then
    select count(*) into remaining
      from public.profiles
     where role in ('admin', 'shop_owner') and id <> old.id;
    if remaining = 0 then
      raise exception 'This is the only admin account and cannot be removed.'
        using errcode = 'check_violation';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger prevent_removing_last_admin
  before update or delete on public.profiles
  for each row execute function private.prevent_removing_last_admin();
