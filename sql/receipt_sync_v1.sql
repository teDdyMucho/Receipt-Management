-- LionRock Receipts: sync migration v1
--
-- Run BY HAND in the Supabase SQL editor. Never from the app or CI.
-- Additive and idempotent: it only adds columns, tables, indexes and a bucket.
-- It does not delete, rename or overwrite anything, so the old screen keeps
-- working against the same tables. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 0. Base tables. On the existing LionRock project these already exist and
--    every statement here is skipped. On a NEW Supabase project they are
--    created with the same columns the old system uses.
-- ---------------------------------------------------------------------------
create table if not exists public.receipt (
  id uuid primary key default gen_random_uuid(),
  receipt_date text,              -- YYYY-MM-DD
  total text,                     -- may start with $
  work_order text,
  tenant_address text,
  type text,                      -- renovation | turn_over | work_order | free text when Other
  type_other text,
  link text,                      -- full access URL
  "user" text,                    -- access NAME or staff user name
  image text,                     -- legacy PDF bytes; not used by new rows
  filename text,                  -- legacy file name
  done_status boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_access_links (
  id uuid primary key default gen_random_uuid(),
  link_name text not null,
  access_token text,
  url text,
  created_by text,
  created_at timestamptz not null default now()
);

-- Link names are unique whatever the letter case.
create unique index if not exists receipt_access_links_name_key
  on public.receipt_access_links (lower(link_name));

create table if not exists public.card_transaction (
  id uuid primary key default gen_random_uuid(),
  cardholder_name text,
  account_ending text,
  transaction_amount text,        -- may start with $
  transaction_date text,
  merchant_name text,
  alert_type text,
  alert_message text,
  notification_threshold text,
  receipt_id uuid,                -- null until matched
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1. receipt: new columns (all nullable)
-- ---------------------------------------------------------------------------
alter table public.receipt add column if not exists client_uuid uuid;
alter table public.receipt add column if not exists device_id text;
alter table public.receipt add column if not exists app_version text;
alter table public.receipt add column if not exists platform text;
alter table public.receipt add column if not exists file_name text;
alter table public.receipt add column if not exists content_type text;
alter table public.receipt add column if not exists file_size integer;
alter table public.receipt add column if not exists checksum_sha256 text;
alter table public.receipt add column if not exists storage_path text;
alter table public.receipt add column if not exists original_path text;
-- pending_on_device | uploading | synced | failed. NULL on legacy rows means synced.
alter table public.receipt add column if not exists sync_status text;
-- Default true: existing rows become true, and rows the OLD screen inserts during
-- the cutover week are true as well (they were confirmed in the old wizard).
-- The new API writes false explicitly until the wizard is done.
alter table public.receipt add column if not exists details_confirmed boolean default true;
alter table public.receipt add column if not exists extracted_fields jsonb;
alter table public.receipt add column if not exists registered_at timestamptz;
alter table public.receipt add column if not exists synced_at timestamptz;
alter table public.receipt add column if not exists attempts integer;
alter table public.receipt add column if not exists last_error text;
alter table public.receipt add column if not exists emailed_to_appfolio_at timestamptz;

-- One row per client_uuid: this is what makes register and retries idempotent.
-- Legacy rows have NULL here; a unique index allows any number of NULLs.
create unique index if not exists receipt_client_uuid_key on public.receipt (client_uuid);

create index if not exists receipt_sync_status_idx on public.receipt (sync_status);
create index if not exists receipt_user_created_idx on public.receipt ("user", created_at desc);

-- ---------------------------------------------------------------------------
-- 2. receipt_access_links: disable switch
-- ---------------------------------------------------------------------------
alter table public.receipt_access_links add column if not exists disabled_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. receipt_devices: one row per phone, written by the heartbeat endpoint
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_devices (
  device_id text primary key,
  identity text,
  platform text,
  os_version text,
  app_version text,
  last_seen_at timestamptz,
  pending_count integer not null default 0,
  uploading_count integer not null default 0,
  failed_count integer not null default 0
);

create index if not exists receipt_devices_identity_idx on public.receipt_devices (identity);

-- Only the API (service-role key) reads and writes this table.
alter table public.receipt_devices enable row level security;

-- ---------------------------------------------------------------------------
-- 4. receipt_api_rate_limits: counters for per-identity rate limiting
--    (serverless functions keep no memory between calls)
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_api_rate_limits (
  bucket text not null,          -- for example "register:NAME"
  window_start timestamptz not null,
  calls integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.receipt_api_rate_limits enable row level security;

-- Atomic "count this call" used by the API. Returns the calls in the window so far.
create or replace function public.receipt_rate_limit_hit(p_bucket text, p_window_start timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.receipt_api_rate_limits (bucket, window_start, calls)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
  do update set calls = public.receipt_api_rate_limits.calls + 1
  returning calls;
$$;

revoke all on function public.receipt_rate_limit_hit(text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: private bucket "receipts"
--    No storage policies are added, so only the service-role key can read or
--    write. Clients get 10-minute signed URLs from the API.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Rollback (run by hand only if needed; this DOES drop the new data)
-- ---------------------------------------------------------------------------
-- drop function if exists public.receipt_rate_limit_hit(text, timestamptz);
-- drop table if exists public.receipt_api_rate_limits;
-- drop table if exists public.receipt_devices;
-- alter table public.receipt_access_links drop column if exists disabled_at;
-- drop index if exists public.receipt_user_created_idx;
-- drop index if exists public.receipt_sync_status_idx;
-- drop index if exists public.receipt_client_uuid_key;
-- alter table public.receipt
--   drop column if exists client_uuid, drop column if exists device_id,
--   drop column if exists app_version, drop column if exists platform,
--   drop column if exists file_name, drop column if exists content_type,
--   drop column if exists file_size, drop column if exists checksum_sha256,
--   drop column if exists storage_path, drop column if exists original_path,
--   drop column if exists sync_status, drop column if exists details_confirmed,
--   drop column if exists extracted_fields, drop column if exists registered_at,
--   drop column if exists synced_at, drop column if exists attempts,
--   drop column if exists last_error, drop column if exists emailed_to_appfolio_at;
-- The "receipts" bucket must be emptied in the dashboard before it can be deleted.
