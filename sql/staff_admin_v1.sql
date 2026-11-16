-- LionRock Receipts: lets an admin create staff accounts from inside the app.
--
-- Additive only: two new functions. No table, column or row is changed.
-- Run by hand in the Supabase SQL editor, after new_project_staff_login.sql.
--
-- Passwords are hashed here in the database (bcrypt), the same way login_user
-- checks them. Only the server (service-role key) may call these functions, and
-- the server calls them only for someone signed in as an admin.

create extension if not exists pgcrypto with schema extensions;

-- Makes one staff account and returns its id. Fails if the email is already used.
create or replace function public.staff_create_user(p_email text, p_name text, p_password text, p_role text default 'user')
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public."user" (email, user_name, password, role, verified_by_admin)
  values (
    lower(trim(p_email)),
    trim(p_name),
    crypt(p_password, gen_salt('bf', 10)),
    case when p_role = 'admin' then 'admin' else 'user' end,
    true
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Sets a new password for one staff account. Returns false when the id is unknown.
create or replace function public.staff_set_password(p_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public."user" set password = crypt(p_password, gen_salt('bf', 10)) where id = p_id;
  return found;
end;
$$;

revoke all on function public.staff_create_user(text, text, text, text) from public, anon, authenticated;
revoke all on function public.staff_set_password(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop function if exists public.staff_create_user(text, text, text, text);
-- drop function if exists public.staff_set_password(uuid, text);
