-- Stop the history from being able to break the thing it records.
--
-- actor_id references profiles, and the trigger fires AFTER UPDATE — so a
-- session whose auth.uid() has no profile row would raise a foreign key
-- violation and take the *booking update* down with it. Assigning a job would
-- simply start failing, and the cause would look nothing like the reason.
--
-- Every real signup gets a profile from handle_new_user, so this is a narrow
-- window: a user deleted from profiles but still holding a valid JWT, or a
-- token minted outside the normal signup path. Narrow is not the same as
-- impossible, and the cost of being wrong here is that the shop cannot
-- dispatch work.
--
-- Resolving the actor through profiles instead of trusting auth.uid() makes
-- the column self-limiting: a known user is recorded, an unknown one is null,
-- and either way the booking update goes through.

create or replace function private.record_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  actor uuid;
begin
  -- Null unless this really is a profile we hold, so the FK can never fail.
  select p.id into actor from public.profiles p where p.id = (select auth.uid());

  if new.status is distinct from old.status then
    kind := case new.status
      when 'confirmed' then 'confirmed'
      when 'assigned' then 'assigned'
      when 'in_progress' then 'started'
      when 'completed' then 'completed'
      when 'cancelled' then 'cancelled'
      when 'pending_payment' then 'reopened'
      else null
    end;

    if kind is not null then
      insert into public.booking_events (
        booking_id, event, from_status, to_status, technician_id, actor_id
      )
      values (new.id, kind, old.status, new.status, new.technician_id, actor);
    end if;

  elsif new.technician_id is distinct from old.technician_id then
    -- Only reached when the technician moved *without* a status change.
    -- Assigning sets both at once, and that is one decision, so it earns one
    -- line on the timeline rather than two.
    insert into public.booking_events (
      booking_id, event, from_status, to_status, technician_id, actor_id
    )
    values (
      new.id,
      case when new.technician_id is null then 'unassigned' else 'reassigned' end,
      old.status, new.status, new.technician_id, actor
    );
  end if;

  return new;
end;
$$;

comment on function private.record_booking_event is
  'Records status and technician changes on a booking. AFTER UPDATE, and resolves the actor through profiles so it can never fail the update it is recording.';
