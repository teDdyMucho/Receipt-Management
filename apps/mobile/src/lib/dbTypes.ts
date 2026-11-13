import type { ExtractedFields, LocalSyncStatus, ReceiptDetails } from '@lionrock/shared';

// Shapes shared by the phone store (db.ts, SQLite) and the browser preview store (db.web.ts).

export interface LocalReceipt {
  client_uuid: string;
  identity: string;
  /** File name inside the private receipts folder (the folder path can change between app updates). */
  local_path: string | null;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum_sha256: string;
  taken_at: string;
  details: Partial<ReceiptDetails>;
  details_confirmed: boolean;
  extracted: ExtractedFields | null;
  sync_status: LocalSyncStatus;
  registered: boolean;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  upload_task_id: string | null;
  server_receipt_id: string | null;
  synced_at: string | null;
}

export interface ReceiptEvent {
  client_uuid: string;
  at: string;
  message: string;
}

/** Upload state fields that the sync code may change. */
export type SyncPatch = Partial<
  Pick<LocalReceipt, 'sync_status' | 'registered' | 'attempts' | 'next_retry_at' | 'last_error' | 'server_receipt_id' | 'synced_at'>
>;

export type NewReceipt = Pick<
  LocalReceipt,
  'client_uuid' | 'identity' | 'local_path' | 'file_name' | 'content_type' | 'file_size' | 'checksum_sha256' | 'taken_at'
>;
