-- A history for a booking, so the job timeline stops guessing.
--
-- The bookings row carries a status but no memory of how it got there. That
-- left the job screen able to say what a job *is* and never when it became
-- that: no "assigned 9:05", no "started 9:20". Dating those from the scheduled
-- time would have been wrong precisely when a job ran late, which is the one
-- time anybody looks.
--
-- Written only by a trigger. There is no client write path at all — a history
-- that can be edited afterwards is not a history — and the SECURITY DEFINER
-- function is what gets the rows in past the revoked grants below.

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event text not null check (
    event in (
      'confirmed', 'assigned', 'reassigned', 'unassigned',
      'started', 'completed', 'cancelled', 'reopened'
    )
  ),
  from_status text,
  to_status text,
  -- Who was on it at the time, kept even if they later leave the team.
  technician_id uuid references public.technicians(id) on delete set null,
  -- Who made the change. Null for anything the service key did.
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The only way this table is ever read: one booking, in order.
create index booking_events_booking_idx on public.booking_events(booking_id, created_at);

comment on table public.booking_events is
  'Append-only history of booking status and technician changes. Written by a trigger; no client may insert, update or delete.';

create or replace function private.record_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
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
      values (
        new.id, kind, old.status, new.status, new.technician_id, (select auth.uid())
      );
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
      old.status, new.status, new.technician_id, (select auth.uid())
    );
  end if;

  return new;
end;
$$;

comment on function private.record_booking_event is
  'Records status and technician changes on a booking. AFTER UPDATE, so it never blocks the write it is recording.';

-- AFTER, not BEFORE: this is a record of something that happened, and it must
-- not be able to fail the change it is describing.
create trigger record_booking_event
  after update on public.bookings
  for each row execute function private.record_booking_event();

-- Read access mirrors bookings_select exactly. Anyone allowed to see a booking
-- is allowed to see what happened to it; nobody else is.
alter table public.booking_events enable row level security;

create policy "booking_events_select" on public.booking_events
  for select using (
    private.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_events.booking_id
        and (
          b.user_id = (select auth.uid())
          or b.technician_id = private.technician_id_for_current_user()
        )
    )
  );

-- Grants are checked before policies, so revoking the writes here is what
-- actually makes this append-only. Leaving them and relying on the absence of
-- an INSERT policy would be a weaker guarantee than it looks.
revoke all on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;
