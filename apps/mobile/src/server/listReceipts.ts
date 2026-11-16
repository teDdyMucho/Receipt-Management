import { rows, supabase, supabaseUrl } from './admin';
import { HttpError } from './http';
import type { SessionUser } from './session';

// SERVER ONLY. Reading receipts back from the database.
// A link name sees only its own receipts. Staff see everyone's.

export interface RemoteReceipt {
  id: string;
  client_uuid: string | null;
  user: string | null;
  created_at: string;
  receipt_date: string | null;
  total: string | null;
  work_order: string | null;
  tenant_address: string | null;
  type: string | null;
  type_other: string | null;
  details_confirmed: boolean | null;
  content_type: string | null;
}

export interface Person {
  name: string;
  receipts: number;
  profile_image: string | null;
}

const COLUMNS = 'id,client_uuid,user,created_at,receipt_date,total,work_order,tenant_address,type,type_other,details_confirmed,content_type';
const PAGE = 200;
const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

export async function listReceipts(user: SessionUser, person?: string | null): Promise<{ receipts: RemoteReceipt[]; people: Person[] }> {
  // The name comes from the signed token. A link name cannot ask for anyone else.
  const only = user.kind === 'access' ? user.name : person?.trim() || null;
  const filter = only ? `&user=${eq(only)}` : '';
  // Receipts deleted in the app keep their row (deleted_at is set) but are never listed.
  const receipts = await rows<RemoteReceipt>(`/rest/v1/receipt?select=${COLUMNS}${filter}&deleted_at=is.null&order=created_at.desc&limit=${PAGE}`);
  return { receipts, people: user.kind === 'staff' ? await listPeople() : [] };
}

/** Everyone who uses the app: each link name with a PIN, plus anyone who has a receipt. */
async function listPeople(): Promise<Person[]> {
  const [accounts, owners] = await Promise.all([
    rows<{ link_name: string; profile_image: string | null }>('/rest/v1/receipt_link_accounts?select=link_name,profile_image&order=link_name.asc'),
    rows<{ user: string | null }>('/rest/v1/receipt?select=user&deleted_at=is.null&limit=10000'),
  ]);
  const people = new Map<string, Person>();
  for (const a of accounts) people.set(a.link_name.toLowerCase(), { name: a.link_name, receipts: 0, profile_image: a.profile_image });
  for (const o of owners) {
    const name = o.user?.trim();
    if (!name) continue;
    const person = people.get(name.toLowerCase()) ?? { name, receipts: 0, profile_image: null };
    person.receipts += 1;
    people.set(name.toLowerCase(), person);
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** A link to the receipt file that works for five minutes. */
export async function receiptFileUrl(user: SessionUser, id: string | null): Promise<{ url: string; content_type: string | null }> {
  if (!id || !/^[0-9a-f-]{8,40}$/i.test(id)) throw new HttpError('Receipt not found.', 404, 'not_found');
  const receipt = (await rows<{ user: string | null; storage_path: string | null; image: string | null; content_type: string | null }>(
    `/rest/v1/receipt?id=${eq(id)}&deleted_at=is.null&select=user,storage_path,image,content_type`,
  ))[0];
  const mine = user.kind === 'staff' || receipt?.user === user.name;
  if (!receipt || !mine) throw new HttpError('Receipt not found.', 404, 'not_found');

  if (!receipt.storage_path) {
    // Older rows keep the file in the `image` column as a data URL.
    if (receipt.image) return { url: receipt.image, content_type: receipt.content_type };
    throw new HttpError('This receipt has no file.', 404, 'no_file');
  }
  const res = await supabase(`/storage/v1/object/sign/receipts/${receipt.storage_path}`, { method: 'POST', body: { expiresIn: 300 } });
  const signed = res.ok ? ((await res.json()) as { signedURL?: string }).signedURL : null;
  if (!signed) throw new HttpError('The file could not be opened.', 502, 'storage_failed');
  return { url: `${supabaseUrl()}/storage/v1${signed}`, content_type: receipt.content_type };
}
