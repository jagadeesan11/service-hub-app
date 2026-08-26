-- Password sign-up collects a name, an email and/or a phone up front. The
-- trigger previously inserted nothing but the id, so all of it was thrown
-- away and onboarding then asked for the name the customer had just typed.
--
-- profiles.email is the CONTACT address, distinct from the login identity in
-- auth.users. Seeding it from the signup email is right precisely because at
-- signup they are the same address; the customer can change either later
-- without affecting the other.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(new.email, ''),
    nullif(new.phone, '')
  );
  return new;
end;
$$;
