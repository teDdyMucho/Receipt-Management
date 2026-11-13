import type { ExtractedFields, ReceiptDetails } from '@lionrock/shared';

// SERVER ONLY. Writes one receipt to Supabase: the file first, then the row.
// The database keys come from the server environment and never reach the app.
//
// With SUPABASE_SERVICE_ROLE_KEY set, the file goes to the private Storage
// bucket "receipts". Without it (anon key only) the file is kept in the legacy
// `image` column as a data URL, which the viewer already understands.

export interface SaveReceiptInput {
  client_uuid: string;
  identity: string;
  device_id?: string;
  app_version?: string;
  platform?: string;
  taken_at: string;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum_sha256: string;
  details?: Partial<ReceiptDetails>;
  details_confirmed?: boolean;
  extracted?: ExtractedFields | null;
  base64: string;
}

export class SaveError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a real service-role key. The anon key pasted into the wrong line is not one. */
function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  try {
    const payload = JSON.parse(atob((key.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function config() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  let serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceKey && !isServiceRoleKey(serviceKey)) {
    console.warn('[save] SUPABASE_SERVICE_ROLE_KEY does not hold a service_role key (it looks like the anon key). Ignoring it.');
    serviceKey = '';
  }
  const key = serviceKey || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new SaveError('The database is not configured on the server.', 503, 'not_configured');
  return { url, key, hasServiceKey: serviceKey.length > 0 };
}

function toBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function saveReceipt(input: SaveReceiptInput) {
  const { url, key, hasServiceKey } = config();
  const auth = { apikey: key, Authorization: `Bearer ${key}` };

  if (!UUID.test(input.client_uuid ?? '')) throw new SaveError('client_uuid is missing or invalid.', 400, 'bad_request');
  if (!blank(input.identity)) throw new SaveError('identity is required.', 400, 'bad_request');
  if (!ALLOWED.includes(input.content_type)) throw new SaveError('Unsupported file type.', 400, 'bad_content_type');
  if (!input.base64) throw new SaveError('The file is missing.', 400, 'bad_file');

  // 1. The bytes must be exactly what the phone hashed.
  const bytes = toBytes(input.base64);
  if (bytes.length > MAX_BYTES) throw new SaveError('The file is too large.', 400, 'too_large');
  const checksum = await sha256Hex(bytes);
  if (checksum !== input.checksum_sha256) throw new SaveError('The file was damaged on the way. It will be sent again.', 400, 'checksum_mismatch');

  // 2. Store the file.
  const taken = new Date(input.taken_at);
  const when = Number.isNaN(taken.getTime()) ? new Date() : taken;
  const ext = input.content_type === 'application/pdf' ? 'pdf' : input.content_type === 'image/png' ? 'png' : 'jpg';
  const objectPath = `${when.getUTCFullYear()}/${String(when.getUTCMonth() + 1).padStart(2, '0')}/${input.client_uuid}.${ext}`;
  let storagePath: string | null = null;
  if (hasServiceKey) {
    const upload = await fetch(`${url}/storage/v1/object/receipts/${objectPath}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': input.content_type, 'x-upsert': 'true' },
      body: bytes,
    });
    if (!upload.ok) {
      console.error('[save] storage error', upload.status, (await upload.text()).slice(0, 300));
      throw new SaveError('The file could not be stored.', 502, 'storage_failed');
    }
    storagePath = objectPath;
  }

  // 3. Write the row. One row per client_uuid, so a retry never makes a duplicate.
  const d = input.details ?? {};
  const now = new Date().toISOString();
  const row = {
    client_uuid: input.client_uuid,
    user: input.identity.trim(),
    receipt_date: blank(d.receipt_date),
    total: blank(d.total),
    work_order: blank(d.work_order),
    tenant_address: blank(d.tenant_address),
    type: blank(d.type),
    type_other: blank(d.type_other),
    filename: input.file_name,
    file_name: input.file_name,
    content_type: input.content_type,
    file_size: bytes.length,
    checksum_sha256: checksum,
    device_id: input.device_id ?? null,
    app_version: input.app_version ?? null,
    platform: input.platform ?? null,
    details_confirmed: input.details_confirmed === true,
    extracted_fields: input.extracted ?? null,
    storage_path: storagePath,
    image: storagePath ? null : `data:${input.content_type};base64,${input.base64}`,
    sync_status: 'synced',
    registered_at: now,
    synced_at: now,
  };

  const res = await fetch(`${url}/rest/v1/receipt?on_conflict=client_uuid&select=id,client_uuid`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error('[save] database error', res.status, detail);
    // 4. The row failed, so the file must not stay behind.
    if (storagePath) {
      await fetch(`${url}/storage/v1/object/receipts/${storagePath}`, { method: 'DELETE', headers: auth }).catch(() => undefined);
    }
    const blocked = res.status === 401 || res.status === 403 || detail.includes('row-level security');
    throw new SaveError(
      blocked ? 'The database refused the save (row level security). The server needs the service-role key.' : 'The receipt could not be saved to the database.',
      502,
      blocked ? 'db_forbidden' : 'db_failed',
    );
  }

  const saved = ((await res.json()) as { id: string }[])[0];
  if (!saved) throw new SaveError('The database did not confirm the save.', 502, 'db_failed');
  return { client_uuid: input.client_uuid, receipt_id: saved.id, checksum, status: 'synced' as const };
}
