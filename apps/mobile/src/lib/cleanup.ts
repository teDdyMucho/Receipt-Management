import { clearLocalFile, getSetting, listReceipts } from './db';
import { deleteReceiptFile } from './files';

// Local copy retention (spec 4.10). Only synced receipts are ever removed from
// the phone, never pending or failed ones.

export const DEFAULT_CLEANUP_DAYS = 14;

export async function getCleanupDays(): Promise<number> {
  const raw = await getSetting('cleanup_days');
  const days = raw === null ? DEFAULT_CLEANUP_DAYS : Number(raw);
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_CLEANUP_DAYS;
}

/** Deletes local files of receipts synced more than N days ago. 0 = keep forever. */
export async function runCleanup(identity: string, now: Date = new Date()): Promise<number> {
  const days = await getCleanupDays();
  if (days === 0) return 0;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  let removed = 0;
  for (const receipt of await listReceipts(identity)) {
    if (receipt.sync_status === 'synced' && receipt.local_path && receipt.synced_at && receipt.synced_at < cutoff) {
      deleteReceiptFile(receipt.local_path);
      await clearLocalFile(receipt.client_uuid);
      removed += 1;
    }
  }
  return removed;
}
