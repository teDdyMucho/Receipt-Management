import * as SQLite from 'expo-sqlite';
import type { ExtractedFields, LocalSyncStatus, ReceiptDetails } from '@lionrock/shared';

// The local receipt store and upload queue (spec 5.1). Everything a receipt
// needs to survive a restart is in this database plus the file on disk.

import type { LocalReceipt, NewReceipt, ReceiptEvent, SyncPatch } from './dbTypes';

export type { LocalReceipt, NewReceipt, ReceiptEvent } from './dbTypes';

interface Row {
  client_uuid: string;
  identity: string;
  local_path: string | null;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum_sha256: string;
  taken_at: string;
  details_json: string | null;
  details_confirmed: number;
  extracted_json: string | null;
  sync_status: LocalSyncStatus;
  registered: number;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  upload_task_id: string | null;
  server_receipt_id: string | null;
  synced_at: string | null;
}

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS local_receipts (
    client_uuid TEXT PRIMARY KEY NOT NULL,
    identity TEXT NOT NULL,
    local_path TEXT,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    details_json TEXT,
    details_confirmed INTEGER NOT NULL DEFAULT 0,
    extracted_json TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    registered INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    last_error TEXT,
    upload_task_id TEXT,
    server_receipt_id TEXT,
    synced_at TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_uuid TEXT NOT NULL,
    at TEXT NOT NULL,
    message TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_receipt_idx ON events (client_uuid, at);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens the database once and creates the tables on first use. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('receipts.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function toReceipt(row: Row): LocalReceipt {
  return {
    ...row,
    details: parseJson<Partial<ReceiptDetails>>(row.details_json) ?? {},
    details_confirmed: row.details_confirmed === 1,
    extracted: parseJson<ExtractedFields>(row.extracted_json),
    registered: row.registered === 1,
  };
}

// --- change notifications: screens re-read the list when anything is written ---
const listeners = new Set<() => void>();
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify() {
  listeners.forEach((l) => l());
}

// --- receipts ---
export async function insertReceipt(r: NewReceipt): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_receipts
      (client_uuid, identity, local_path, file_name, content_type, file_size, checksum_sha256, taken_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [r.client_uuid, r.identity, r.local_path, r.file_name, r.content_type, r.file_size, r.checksum_sha256, r.taken_at],
  );
  await addEvent(r.client_uuid, 'Saved on this phone');
}

/** This identity's receipts, newest first. */
export async function listReceipts(identity: string): Promise<LocalReceipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM local_receipts WHERE identity = ? ORDER BY taken_at DESC',
    [identity],
  );
  return rows.map(toReceipt);
}

export async function getReceipt(clientUuid: string): Promise<LocalReceipt | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM local_receipts WHERE client_uuid = ?', [clientUuid]);
  return row ? toReceipt(row) : null;
}

export async function saveDetails(
  clientUuid: string,
  details: Partial<ReceiptDetails>,
  confirmed: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE local_receipts SET details_json = ?, details_confirmed = ? WHERE client_uuid = ?', [
    JSON.stringify(details),
    confirmed ? 1 : 0,
    clientUuid,
  ]);
  await addEvent(clientUuid, confirmed ? 'Details confirmed' : 'Details saved for later');
}

export async function saveExtracted(clientUuid: string, fields: ExtractedFields): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE local_receipts SET extracted_json = ? WHERE client_uuid = ?', [
    JSON.stringify(fields),
    clientUuid,
  ]);
  await addEvent(clientUuid, 'Details read by AI');
}

const SYNC_COLUMNS = ['sync_status', 'registered', 'attempts', 'next_retry_at', 'last_error', 'server_receipt_id', 'synced_at'] as const;

/** Changes the upload state of a receipt. Only the columns listed above can be set. */
export async function updateSync(clientUuid: string, patch: SyncPatch): Promise<void> {
  const columns = SYNC_COLUMNS.filter((c) => patch[c] !== undefined);
  if (columns.length === 0) return;
  const values = columns.map((c) => {
    const value = patch[c];
    return typeof value === 'boolean' ? (value ? 1 : 0) : (value ?? null);
  });
  const db = await getDb();
  await db.runAsync(`UPDATE local_receipts SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE client_uuid = ?`, [
    ...values,
    clientUuid,
  ]);
  notify();
}

/** Manual Retry: back to pending with the attempt counter reset. */
export async function resetForRetry(clientUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_receipts
        SET sync_status = 'pending', attempts = 0, next_retry_at = NULL, last_error = NULL
      WHERE client_uuid = ?`,
    [clientUuid],
  );
  await addEvent(clientUuid, 'Retry requested');
}

export async function deleteReceiptRow(clientUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM local_receipts WHERE client_uuid = ?', [clientUuid]);
  await db.runAsync('DELETE FROM events WHERE client_uuid = ?', [clientUuid]);
  notify();
}

/** After local cleanup the row stays, without a file on the phone. */
export async function clearLocalFile(clientUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE local_receipts SET local_path = NULL WHERE client_uuid = ?', [clientUuid]);
  await addEvent(clientUuid, 'Removed from this phone (still on the server)');
}

// --- events ---
export async function addEvent(clientUuid: string, message: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO events (client_uuid, at, message) VALUES (?, ?, ?)', [
    clientUuid,
    new Date().toISOString(),
    message,
  ]);
  notify();
}

export async function listEvents(clientUuid?: string): Promise<ReceiptEvent[]> {
  const db = await getDb();
  if (clientUuid) {
    return db.getAllAsync<ReceiptEvent>(
      'SELECT client_uuid, at, message FROM events WHERE client_uuid = ? ORDER BY at ASC, id ASC',
      [clientUuid],
    );
  }
  return db.getAllAsync<ReceiptEvent>('SELECT client_uuid, at, message FROM events ORDER BY at ASC, id ASC');
}

// --- settings ---
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
  notify();
}
