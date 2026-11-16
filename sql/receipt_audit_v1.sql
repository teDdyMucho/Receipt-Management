-- LionRock Receipts: delete from the app, and an audit log.
--
-- Additive only: two new columns on receipt and one new table.
-- No existing column or row is changed. Run by hand in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Deleting a receipt in the app
-- ---------------------------------------------------------------------------
-- A receipt deleted in the app gets a date here and disappears from every
-- screen of the app. The row and its file are kept, so a receipt deleted by
-- mistake (or on purpose) can still be found and brought back by hand.
alter table public.receipt add column if not exists deleted_at timestamptz;
alter table public.receipt add column if not exists deleted_by text;

create index if not exists receipt_deleted_at_idx on public.receipt (deleted_at);

-- ---------------------------------------------------------------------------
-- 2. Audit log: who uploaded, edited or deleted which receipt, and when
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_audit (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,            -- the link name or staff name who did it
  actor_kind text not null,       -- 'access' (link name) or 'staff'
  action text not null,           -- 'upload', 'edit' or 'delete'
  receipt_id text,
  receipt_owner text,             -- whose receipt it is
  summary text,                   -- one line, for the list in the app
  changes jsonb                   -- for an edit: the fields before and after
);

create index if not exists receipt_audit_at_idx on public.receipt_audit (at desc);

-- Only the server (service-role key) reads or writes it. The app shows it to admins only.
alter table public.receipt_audit enable row level security;

-- ---------------------------------------------------------------------------
-- Useful by hand
-- ---------------------------------------------------------------------------
-- See deleted receipts:
--   select id, "user", total, receipt_date, deleted_at, deleted_by from public.receipt where deleted_at is not null;
-- Bring one back:
--   update public.receipt set deleted_at = null, deleted_by = null where id = 'PUT-THE-ID-HERE';

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- drop table if exists public.receipt_audit;
-- drop index if exists public.receipt_deleted_at_idx;
-- alter table public.receipt drop column if exists deleted_at, drop column if exists deleted_by;
