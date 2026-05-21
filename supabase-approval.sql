-- Finans Hub user approval gate.
-- Run once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists is_approved boolean not null default false;

-- Keep existing users active. New signups remain pending by default.
update public.profiles
set is_approved = true
where is_approved = false
  and coalesce(is_banned, false) = false;

-- Make sure admins can never lock themselves out by approval state.
update public.profiles
set is_approved = true
where coalesce(is_admin, false) = true;
