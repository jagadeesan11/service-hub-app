-- Ratings and comments on completed jobs (feedback-module-plan.md, slice A).

create table public.service_feedback (
  id uuid primary key default gen_random_uuid(),
  -- One job, one review. Not one per customer and not one per service: the
  -- unit of work is the booking, which also makes "have they reviewed this
  -- yet?" a single index lookup.
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Snapshotted at submit time rather than joined at read time: a booking's
  -- technician can be reassigned afterwards, and the review belongs to
  -- whoever actually did the work.
  service_id uuid not null references public.services(id) on delete restrict,
  technician_id uuid references public.technicians(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  tags text[] not null default '{}',
  -- Soft hide, never delete: pulling an abusive comment must not quietly
  -- improve the average.
  is_published boolean not null default true,
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_feedback_service_id_idx on public.service_feedback(service_id);
create index service_feedback_technician_id_idx on public.service_feedback(technician_id);
create index service_feedback_user_id_idx on public.service_feedback(user_id);
-- The morning queue: low ratings nobody has answered yet.
create index service_feedback_triage_idx on public.service_feedback(rating, responded_at)
  where rating <= 2;

create trigger set_updated_at
  before update on public.service_feedback
  for each row execute function private.set_updated_at();

-- denormalised aggregates ----------------------------------------------------
-- The catalogue is read on every app open; reviews are written a few times a
-- day. Computing an average on read would be the wrong trade, and a view
-- would either leak individual rows through RLS or need security definer.

alter table public.services
  add column rating_avg numeric(3, 2),
  add column rating_count integer not null default 0;

alter table public.technicians
  add column rating_avg numeric(3, 2),
  add column rating_count integer not null default 0;

create or replace function private.refresh_feedback_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_service uuid := coalesce(new.service_id, old.service_id);
  target_tech uuid := coalesce(new.technician_id, old.technician_id);
begin
  update public.services s
     set rating_count = agg.n,
         rating_avg = agg.avg
    from (
      select count(*) as n, round(avg(rating), 2) as avg
        from public.service_feedback
       where service_id = target_service and is_published
    ) agg
   where s.id = target_service;

  if target_tech is not null then
    update public.technicians t
       set rating_count = agg.n,
           rating_avg = agg.avg
      from (
        select count(*) as n, round(avg(rating), 2) as avg
          from public.service_feedback
         where technician_id = target_tech and is_published
      ) agg
     where t.id = target_tech;
  end if;

  return null;
end;
$$;

create trigger refresh_feedback_aggregates
  after insert or update or delete on public.service_feedback
  for each row execute function private.refresh_feedback_aggregates();

-- rules ----------------------------------------------------------------------

-- RLS gates rows, not columns. Without this a customer could publish their own
-- admin response or unhide a review an admin had pulled -- the same shape of
-- hole as the profiles role escalation.
create or replace function private.enforce_feedback_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  if private.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select * into b from public.bookings where id = new.booking_id;
    if not found or b.user_id is distinct from (select auth.uid()) then
      raise exception 'You can only review your own booking'
        using errcode = 'insufficient_privilege';
    end if;
    if b.status <> 'completed' then
      raise exception 'This job is not finished yet, so it cannot be reviewed'
        using errcode = 'check_violation';
    end if;

    -- Derived here, not trusted from the client, so a review cannot be
    -- attributed to a service or technician that had nothing to do with it.
    new.user_id := b.user_id;
    new.service_id := b.service_id;
    new.technician_id := b.technician_id;
    new.is_published := true;
    new.admin_response := null;
    new.responded_at := null;
    return new;
  end if;

  if new.is_published is distinct from old.is_published
    or new.admin_response is distinct from old.admin_response
    or new.responded_at is distinct from old.responded_at
    or new.booking_id is distinct from old.booking_id
    or new.service_id is distinct from old.service_id
    or new.technician_id is distinct from old.technician_id
    or new.user_id is distinct from old.user_id
  then
    raise exception 'Only Nexora can moderate or respond to a review'
      using errcode = 'insufficient_privilege';
  end if;

  -- A short window to fix a hasty rating, then it settles. Otherwise the
  -- averages keep moving under everyone.
  if old.created_at < now() - interval '7 days' then
    raise exception 'A review can only be changed within 7 days of leaving it'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger enforce_feedback_integrity
  before insert or update on public.service_feedback
  for each row execute function private.enforce_feedback_integrity();

alter table public.service_feedback enable row level security;

create policy "service_feedback_select" on public.service_feedback
  for select using (
    user_id = (select auth.uid())
    or private.is_admin()
    or technician_id = private.technician_id_for_current_user()
  );

create policy "service_feedback_insert" on public.service_feedback
  for insert with check (user_id = (select auth.uid()) or private.is_admin());

create policy "service_feedback_update" on public.service_feedback
  for update using (user_id = (select auth.uid()) or private.is_admin())
  with check (user_id = (select auth.uid()) or private.is_admin());

create policy "service_feedback_delete_admin" on public.service_feedback
  for delete using (private.is_admin());

-- Per-category quick-pick chips, so a second vertical asks its own questions
-- without a code change (feedback-module-plan.md, slice D -- cheap to include
-- now that the table exists).
alter table public.categories add column feedback_tags text[] not null default '{}';

update public.categories
   set feedback_tags = array['Finish quality', 'Punctuality', 'Cleanliness', 'Value for money', 'Communication']
 where feedback_tags = '{}';
