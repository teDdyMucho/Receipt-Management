import type { ReceiptDetails } from '@lionrock/shared';
import { SERVER_HEADERS, getServerBase, serverProblem, sessionHeaders } from './server';

// Sign in, profile and reading receipts back from the server. The app calls our
// own server and nothing else: no Supabase key and no n8n URL exist in this app.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

const OFFLINE = 'Could not reach the server. Check your connection and try again.';

async function call<T>(path: string, options: { body?: unknown; signedIn?: boolean } = {}): Promise<T> {
  const base = await getServerBase();
  const problem = await serverProblem(base);
  if (problem) throw new ApiError(problem, 0, 'no_server');

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      headers: options.signedIn ? await sessionHeaders() : SERVER_HEADERS,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(OFFLINE, 0, 'offline');
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new ApiError('The server is not answering. Try again in a moment.', res.status, 'not_json');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code ?? 'unknown');
  return data as T;
}

/** The message to show for any failed call. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export interface SignedIn {
  name: string;
  token: string;
  profile_image?: string | null;
  role?: string;
}

export const checkAccessName = (name: string) =>
  call<{ name: string; status: 'available' | 'taken' | 'disabled' }>('/api/access/check', { body: { name } });

export const claimAccessName = (name: string, pin: string) => call<SignedIn>('/api/access/claim', { body: { name, pin } });

export const loginAccessName = (name: string, pin: string) => call<SignedIn>('/api/access/login', { body: { name, pin } });

export const staffLogin = (email: string, password: string) => call<SignedIn>('/api/auth/login', { body: { email, password } });

export const getProfile = () =>
  call<{ name: string; profile_image: string | null; created_at: string }>('/api/access/profile', { signedIn: true });

export const setProfileImage = (profile_image: string | null) =>
  call<{ profile_image: string | null }>('/api/access/profile', { body: { profile_image }, signedIn: true });

export const changePin = (current_pin: string, new_pin: string) =>
  call<{ ok: boolean }>('/api/access/pin', { body: { current_pin, new_pin }, signedIn: true });

/** Deletes the signed-in link account for good. The PIN is checked again. */
export const deleteMyAccount = (pin: string) => call<{ ok: boolean }>('/api/access/delete', { body: { pin }, signedIn: true });

export interface StaffAccount {
  id: string;
  email: string;
  user_name: string | null;
  role: string | null;
  created_at: string;
}

// Admin only. The server refuses these for anyone else.
export const listStaff = () => call<{ staff: StaffAccount[] }>('/api/staff/list', { signedIn: true });

export const createStaff = (account: { email: string; name: string; password: string; role: 'user' | 'admin' }) =>
  call<{ id: string }>('/api/staff/create', { body: account, signedIn: true });

export const setStaffPassword = (id: string, password: string) =>
  call<{ ok: boolean }>('/api/staff/password', { body: { id, password }, signedIn: true });

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

export const listRemoteReceipts = (person?: string | null) =>
  call<{ receipts: RemoteReceipt[]; people: Person[] }>(`/api/receipts/list${person ? `?person=${encodeURIComponent(person)}` : ''}`, { signedIn: true });

/** Staff and admins: correct the details of any receipt. */
export const updateRemoteReceipt = (id: string, details: ReceiptDetails) =>
  call<{ ok: boolean; changed: number }>('/api/receipts/update', { body: { id, details }, signedIn: true });

/** Removes the receipt from the app for everyone. */
export const deleteRemoteReceipt = (id: string) => call<{ ok: boolean }>('/api/receipts/delete', { body: { id }, signedIn: true });

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actor_kind: string;
  action: 'upload' | 'edit' | 'delete';
  receipt_id: string | null;
  receipt_owner: string | null;
  summary: string | null;
  changes: Record<string, { from: string | null; to: string | null }> | null;
}

/** Admin only. */
export const listAudit = () => call<{ entries: AuditEntry[] }>('/api/audit/list', { signedIn: true });

export const receiptFileUrl =(id: string) =>
  call<{ url: string; content_type: string | null }>(`/api/receipts/file?id=${encodeURIComponent(id)}`, { signedIn: true });
