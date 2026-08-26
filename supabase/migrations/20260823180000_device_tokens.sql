-- Phase 7, Prompt 18: device push tokens.

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_tokens_profile_id_idx on public.device_tokens(profile_id);

create trigger set_updated_at
  before update on public.device_tokens
  for each row execute function private.set_updated_at();

alter table public.device_tokens enable row level security;

create policy "device_tokens_owner" on public.device_tokens
  for all using (profile_id = (select auth.uid()) or private.is_admin())
  with check (profile_id = (select auth.uid()) or private.is_admin());
