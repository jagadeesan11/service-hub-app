-- Allow an admin to delete a completed or settled booking, deliberately.
--
-- Previously refused outright, on the grounds that it destroys accounting
-- records. That reasoning still holds, but it made clearing test data
-- impossible, and the shop owner is entitled to remove their own records.
--
-- So the delete exists on a separate, explicit path rather than the ordinary
-- one. Two things stay true:
--   * a plain DELETE still refuses anything settled, so a stray client call
--     or a mis-scripted cleanup cannot erase a paid job;
--   * removing a billed job removes its bill too, which leaves a gap in the
--     invoice sequence. That is unavoidable and is surfaced in the UI.

-- The invoice foreign key was ON DELETE RESTRICT, which made this physically
-- impossible regardless of policy. Cascade, so a deliberate delete takes the
-- bill with the job instead of failing halfway.
alter table public.invoices drop constraint if exists invoices_booking_id_fkey;
alter table public.invoices
  add constraint invoices_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete cascade;

/** Transaction-local opt-in, set only by admin_force_delete_booking(). */
create or replace function private.force_delete_allowed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('nexora.force_delete', true), '') = 'on';
$$;

create or replace function private.prevent_deleting_settled_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The deliberate path has already checked who is asking and warned them.
  if private.force_delete_allowed() then
    return old;
  end if;

  if exists (
    select 1 from public.payments
     where booking_id = old.id and status in ('paid', 'refunded')
  ) then
    raise exception
      'This booking has money against it. Use the confirmed delete if you really mean to remove it, or cancel it instead.'
      using errcode = 'check_violation';
  end if;

  if old.status = 'completed' then
    raise exception
      'A completed job needs a confirmed delete. Cancel it instead if it should not have been marked done.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create or replace function public.admin_force_delete_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  -- security definer bypasses RLS, so the caller is checked by hand.
  if not private.is_admin() then
    raise exception 'Only an admin can delete a booking'
      using errcode = 'insufficient_privilege';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'no_data_found';
  end if;

  perform set_config('nexora.force_delete', 'on', true);

  -- Cascades take the payments, the feedback and the bill with it.
  delete from public.bookings where id = b.id;
end;
$$;

revoke all on function public.admin_force_delete_booking(uuid) from public;
revoke execute on function public.admin_force_delete_booking(uuid) from anon;
grant execute on function public.admin_force_delete_booking(uuid) to authenticated;
