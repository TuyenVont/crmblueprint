begin;

-- =========================================================
-- 006 AUTH BOOTSTRAP
-- auth.users -> public.profiles
-- =========================================================


-- =========================================================
-- 1. NEW USER PROFILE FUNCTION
-- =========================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin

  v_full_name :=
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    );

  insert into public.profiles (
    id,
    full_name,
    avatar_url,
    phone
  )
  values (
    new.id,
    v_full_name,
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    new.phone
  )
  on conflict (id)
  do nothing;

  return new;

end;
$$;


-- =========================================================
-- 2. PROTECT FUNCTION
-- =========================================================

revoke all
on function private.handle_new_user()
from public, anon, authenticated;


-- =========================================================
-- 3. AUTH TRIGGER
-- =========================================================

drop trigger if exists on_auth_user_created
on auth.users;


create trigger on_auth_user_created
after insert
on auth.users
for each row
execute function private.handle_new_user();


-- =========================================================
-- 4. BACKFILL EXISTING AUTH USERS
--
-- Useful if you already created test users before migration 006.
-- =========================================================

insert into public.profiles (
  id,
  full_name,
  avatar_url,
  phone
)
select
  u.id,

  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'User'
  ),

  nullif(
    u.raw_user_meta_data ->> 'avatar_url',
    ''
  ),

  u.phone

from auth.users u

where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);


-- =========================================================
-- 5. CLIENT SHOULD NO LONGER INSERT PROFILES DIRECTLY
--
-- Profile creation is now owned by the Auth trigger.
-- =========================================================

revoke insert
on public.profiles
from authenticated;


drop policy if exists "profiles_insert_self"
on public.profiles;


commit;