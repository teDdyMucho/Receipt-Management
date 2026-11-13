import type { LocalSyncStatus } from './types';

// Retry schedule and upload-queue rules (spec sections 4.3, 4.5, 4.6 and 9).

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Delay after the 1st, 2nd, ... failed attempt; later attempts use the last value. */
export const BACKOFF_DELAYS_MS = [30 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 30 * MINUTE];

/** After this many failed attempts the receipt becomes `failed` and waits for a manual Retry. */
export const MAX_ATTEMPTS = 10;

/** Delay to wait after `attempts` failed attempts (1-based). */
export function backoffDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), BACKOFF_DELAYS_MS.length) - 1;
  return BACKOFF_DELAYS_MS[index] as number;
}

/** When the receipt may be tried again, as an ISO string. */
export function nextRetryAt(attempts: number, now: Date = new Date()): string {
  return new Date(now.getTime() + backoffDelayMs(attempts)).toISOString();
}

export function hasExhaustedRetries(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

interface QueueItem {
  client_uuid: string;
  taken_at: string;
  sync_status: LocalSyncStatus;
  next_retry_at: string | null;
}

/** Pending receipts that are due now, oldest `taken_at` first. The worker takes the first one. */
export function dueQueue<T extends QueueItem>(items: T[], now: Date = new Date()): T[] {
  const nowIso = now.toISOString();
  return items
    .filter((i) => i.sync_status === 'pending' && (!i.next_retry_at || i.next_retry_at <= nowIso))
    .sort((a, b) => a.taken_at.localeCompare(b.taken_at) || a.client_uuid.localeCompare(b.client_uuid));
}

interface ServerState {
  sync_status: string | null;
  checksum: string | null;
}

/**
 * Crash recovery for a row found in `uploading` (or a registered `pending` row)
 * on launch: synced only when the server says so with the same checksum,
 * otherwise back to `pending` so it is retried.
 */
export function reconcileStatus(localChecksum: string, server: ServerState | null): 'synced' | 'pending' {
  if (server && server.sync_status === 'synced' && server.checksum === localChecksum) return 'synced';
  return 'pending';
}
