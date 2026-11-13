-- LionRock Receipts: staff login for a NEW Supabase project only.
--
-- Do NOT run this on the existing LionRock project: it already has the "user"
-- table and login_user, and this file would replace that function.
-- Run by hand in the Supabase SQL editor, after receipt_sync_v1.sql.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public."user" (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_name text,
  password text,                  -- bcrypt hash, never plain text
  role text not null default 'user',   -- 'admin' sees SMS, Disable link and Show QR
  verified_by_admin boolean default false,
  created_at timestamptz not null default now()
);

create unique index if not exists user_email_key on public."user" (lower(email));

-- Nobody reads this table with the public key; only login_user and the API do.
alter table public."user" enable row level security;

-- Returns the user row (without the password) when the email and password match.
create or replace function public.login_user(p_email text, p_password text)
returns table (id uuid, email text, user_name text, role text, verified_by_admin boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select u.id, u.email, u.user_name::text, u.role, coalesce(u.verified_by_admin, false), u.created_at
      from public."user" u
     where lower(u.email) = lower(trim(p_email))
       and u.password is not null
       and u.password = crypt(p_password, u.password)
     limit 1;
end;
$$;

-- Only the API (service-role key) may call it.
revoke all on function public.login_user(text, text) from public, anon, authenticated;

-- Add the first admin (change the three values, then run this statement once):
-- insert into public."user" (email, user_name, password, role, verified_by_admin)
-- values ('you@example.com', 'Your Name', crypt('choose-a-password', gen_salt('bf', 10)), 'admin', true);
