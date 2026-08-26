-- Customer help requests, chiefly "I can't sign in, please reset my password".
--
-- Self-service reset needs a working mail sender; this needs nothing. The
-- customer leaves a contact, an admin recognises the account and sets a
-- password from the Users page. It also collects general questions, so there
-- is one queue rather than two.

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'password_reset'
    check (kind in ('password_reset', 'question')),

  -- Exactly what was typed, kept verbatim so an admin can see what the
  -- customer believes their contact is, plus the normalised forms used to
  -- match it against an account.
  contact_raw text not null check (char_length(contact_raw) between 3 and 120),
  contact_email text check (contact_email is null or char_length(contact_email) <= 120),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 20),

  message text check (message is null or char_length(message) <= 1000),

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create index support_requests_status_idx on public.support_requests(status, created_at desc);
create index support_requests_contact_idx on public.support_requests(contact_email, contact_phone);

create trigger set_updated_at
  before update on public.support_requests
  for each row execute function private.set_updated_at();

alter table public.support_requests enable row level security;

-- Anyone may ask for help, signed in or not — the whole point is that the
-- person is locked out. This is the one table anon is allowed to write, and
-- it is write-only for them: no policy lets anon read anything back, so the
-- queue cannot be used to enumerate who has an account.
create policy support_requests_insert_anyone
  on public.support_requests for insert
  with check (true);

create policy support_requests_select_admin
  on public.support_requests for select
  using (private.is_admin());

create policy support_requests_update_admin
  on public.support_requests for update
  using (private.is_admin()) with check (private.is_admin());

create policy support_requests_delete_admin
  on public.support_requests for delete
  using (private.is_admin());

-- The blanket revoke in 20260826120000 covers every table including this one,
-- so INSERT has to be handed back deliberately. Only INSERT.
grant insert on public.support_requests to anon;

-- A locked-out customer submits once, maybe twice. Anything past a few open
-- requests for the same contact is a mistake or a flood, and either way the
-- admin queue should not carry it.
create or replace function private.limit_open_support_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  open_count integer;
begin
  select count(*) into open_count
    from public.support_requests
   where contact_raw = new.contact_raw
     and status <> 'resolved';

  if open_count >= 3 then
    raise exception 'We already have a request open for this contact. We will be in touch shortly.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger limit_open_support_requests
  before insert on public.support_requests
  for each row execute function private.limit_open_support_requests();

comment on table public.support_requests is
  'Customer-submitted help requests. Insertable by anyone (including anon, who cannot read it back); readable and manageable by admins only.';
