-- LionRock Receipts: link names with a PIN.
--
-- Additive only: one new table. Nothing existing is changed or removed.
-- Run by hand in the Supabase SQL editor, after receipt_sync_v1.sql.
--
-- How it is used: the first person to type a link name in the app sets a PIN,
-- and that makes one row here. Anyone else who types the same name is told the
-- link is not available. The owner signs in again with the PIN.

create table if not exists public.receipt_link_accounts (
  name_key text primary key,              -- the name in lower case; one account per name
  link_name text not null,                -- the name as the person typed it
  pin_hash text not null,                 -- PBKDF2 hash, never the PIN itself
  pin_salt text not null,
  pin_failed_count integer not null default 0,
  pin_locked_until timestamptz,           -- set for 15 minutes after 5 wrong PINs
  profile_image text,                     -- small picture as a data URL
  disabled_at timestamptz,                -- set a date here to switch the account off
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Only the server (service-role key) reads or writes this table.
-- With row level security on and no policies, the public key sees nothing.
alter table public.receipt_link_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- Useful by hand
-- ---------------------------------------------------------------------------
-- Someone forgot their PIN: delete their row, then they set a new PIN in the app.
-- Their receipts are not touched (they live in the receipt table).
--   delete from public.receipt_link_accounts where name_key = lower('Enrique');
--
-- Switch a name off without deleting it:
--   update public.receipt_link_accounts set disabled_at = now() where name_key = lower('Enrique');

-- ---------------------------------------------------------------------------
-- Rollback (only if this must be undone; it removes every PIN and picture)
-- ---------------------------------------------------------------------------
-- drop table if exists public.receipt_link_accounts;
