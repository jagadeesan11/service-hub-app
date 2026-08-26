-- Phase 2, Prompt 7 needs a service "status" column for the admin table
-- (bookable/hidden), which wasn't part of the original Section 2 data model.

alter table public.services
  add column is_active boolean not null default true;
