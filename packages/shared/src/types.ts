// Types shared by the mobile app, the web workspace and the API.

/** File state on the phone (spec 5.1). */
export type LocalSyncStatus = 'pending' | 'uploading' | 'synced' | 'failed';

/** File state on the server (spec 5.2). Null on legacy rows means synced. */
export type ServerSyncStatus = 'pending_on_device' | 'uploading' | 'synced' | 'failed';

export type ReceiptType = 'renovation' | 'turn_over' | 'work_order';

/** The fields the Receipt Data wizard collects. */
export interface ReceiptDetails {
  /** `renovation`, `turn_over`, `work_order`, or free text when Other. */
  type: string;
  type_other: string | null;
  /** `YYYY-MM-DD` */
  receipt_date: string | null;
  total: string | null;
  work_order: string | null;
  tenant_address: string | null;
}

/** What AI extraction returns after `parseReceiptFields`. */
export interface ExtractedFields {
  receipt_date: string | null;
  total: string | null;
  work_order: string | null;
  tenant_address: string | null;
}

/** A `receipt` row as list queries return it (never includes `image`). */
export interface ReceiptRow {
  id: string;
  receipt_date: string | null;
  total: string | null;
  work_order: string | null;
  tenant_address: string | null;
  type: string | null;
  type_other: string | null;
  link: string | null;
  user: string | null;
  done_status: boolean | null;
  created_at: string;
  client_uuid: string | null;
  device_id: string | null;
  app_version: string | null;
  platform: string | null;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
  checksum_sha256: string | null;
  storage_path: string | null;
  original_path: string | null;
  sync_status: ServerSyncStatus | null;
  details_confirmed: boolean | null;
  extracted_fields: ExtractedFields | null;
  registered_at: string | null;
  synced_at: string | null;
  attempts: number | null;
  last_error: string | null;
  emailed_to_appfolio_at: string | null;
}

export interface CardTransactionRow {
  id: string;
  cardholder_name: string | null;
  account_ending: string | null;
  transaction_amount: string | null;
  transaction_date: string | null;
  merchant_name: string | null;
  alert_type: string | null;
  alert_message: string | null;
  notification_threshold: string | null;
  receipt_id: string | null;
  created_at: string;
}

export interface RegisterRequest {
  client_uuid: string;
  device_id: string;
  taken_at: string;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum_sha256: string;
  app_version?: string;
  platform?: string;
  details?: Partial<ReceiptDetails>;
  details_confirmed?: boolean;
}

export interface FileConfirmResponse {
  client_uuid: string;
  receipt_id: string;
  checksum: string;
  status: 'synced';
}

export interface StatusResponse {
  client_uuid: string;
  receipt_id: string;
  sync_status: ServerSyncStatus | null;
  checksum: string | null;
  details_confirmed: boolean;
  extracted_fields: ExtractedFields | null;
}

export interface HeartbeatRequest {
  device_id: string;
  app_version: string;
  platform: string;
  os_version: string;
  pending_count: number;
  uploading_count: number;
  failed_count: number;
}

/** Every API error body. */
export interface ApiError {
  error: string;
  code: string;
}

export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];
