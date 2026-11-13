import type { ExtractedFields, ReceiptDetails } from '@lionrock/shared';
import type { LocalReceipt, NewReceipt, ReceiptEvent, SyncPatch } from './dbTypes';

export type { LocalReceipt, NewReceipt, ReceiptEvent } from './dbTypes';

// Browser preview store. Same functions as db.ts, kept in the browser's local
// storage instead of SQLite. This is for looking at the app on a computer; the
// real receipt store is the SQLite one on the phone.

interface Store {
  receipts: LocalReceipt[];
  events: ReceiptEvent[];
  settings: Record<string, string | null>;
}

const KEY = 'receipts.db';
let store: Store | null = null;

function load(): Store {
  if (store) return store;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    store = raw ? (JSON.parse(raw) as Store) : null;
  } catch {
    store = null;
  }
  store ??= { receipts: [], events: [], settings: {} };
  return store;
}

function save() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(load()));
  } catch {
    // storage full or blocked: the data stays in memory for this tab
  }
}

const listeners = new Set<() => void>();
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function changed() {
  save();
  listeners.forEach((l) => l());
}

export async function getDb(): Promise<void> {
  load();
}

function find(clientUuid: string): LocalReceipt | undefined {
  return load().receipts.find((r) => r.client_uuid === clientUuid);
}

export async function insertReceipt(r: NewReceipt): Promise<void> {
  load().receipts.push({
    ...r,
    details: {},
    details_confirmed: false,
    extracted: null,
    sync_status: 'pending',
    registered: false,
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    upload_task_id: null,
    server_receipt_id: null,
    synced_at: null,
  });
  await addEvent(r.client_uuid, 'Saved on this phone');
}

export async function listReceipts(identity: string): Promise<LocalReceipt[]> {
  return load()
    .receipts.filter((r) => r.identity === identity)
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at))
    .map((r) => ({ ...r }));
}

export async function getReceipt(clientUuid: string): Promise<LocalReceipt | null> {
  const r = find(clientUuid);
  return r ? { ...r } : null;
}

export async function saveDetails(
  clientUuid: string,
  details: Partial<ReceiptDetails>,
  confirmed: boolean,
): Promise<void> {
  const r = find(clientUuid);
  if (r) {
    r.details = details;
    r.details_confirmed = confirmed;
  }
  await addEvent(clientUuid, confirmed ? 'Details confirmed' : 'Details saved for later');
}

export async function saveExtracted(clientUuid: string, fields: ExtractedFields): Promise<void> {
  const r = find(clientUuid);
  if (r) r.extracted = fields;
  await addEvent(clientUuid, 'Details read by AI');
}

export async function updateSync(clientUuid: string, patch: SyncPatch): Promise<void> {
  const r = find(clientUuid);
  if (r) Object.assign(r, patch);
  changed();
}

export async function resetForRetry(clientUuid: string): Promise<void> {
  const r = find(clientUuid);
  if (r) {
    r.sync_status = 'pending';
    r.attempts = 0;
    r.next_retry_at = null;
    r.last_error = null;
  }
  await addEvent(clientUuid, 'Retry requested');
}

export async function deleteReceiptRow(clientUuid: string): Promise<void> {
  const s = load();
  s.receipts = s.receipts.filter((r) => r.client_uuid !== clientUuid);
  s.events = s.events.filter((e) => e.client_uuid !== clientUuid);
  changed();
}

export async function clearLocalFile(clientUuid: string): Promise<void> {
  const r = find(clientUuid);
  if (r) r.local_path = null;
  await addEvent(clientUuid, 'Removed from this phone (still on the server)');
}

export async function addEvent(clientUuid: string, message: string): Promise<void> {
  load().events.push({ client_uuid: clientUuid, at: new Date().toISOString(), message });
  changed();
}

export async function listEvents(clientUuid?: string): Promise<ReceiptEvent[]> {
  const events = load().events;
  return clientUuid ? events.filter((e) => e.client_uuid === clientUuid) : [...events];
}

export async function getSetting(key: string): Promise<string | null> {
  return load().settings[key] ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  load().settings[key] = value;
  changed();
}
