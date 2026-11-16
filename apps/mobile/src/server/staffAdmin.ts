import { rows, supabase } from './admin';
import { HttpError } from './http';
import { requireSession, type SessionUser } from './session';

// SERVER ONLY. Staff accounts, managed by an admin from inside the app.
// Passwords are hashed in the database (sql/staff_admin_v1.sql); they are never stored or logged here.

export interface StaffAccount {
  id: string;
  email: string;
  user_name: string | null;
  role: string | null;
  created_at: string;
}

const MIN_PASSWORD = 8;

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireSession(request, 'staff');
  if (user.role !== 'admin') throw new HttpError('Only an admin can manage staff accounts.', 403, 'forbidden');
  return user;
}

function checkedPassword(input: unknown): string {
  if (typeof input !== 'string' || input.length < MIN_PASSWORD || input.length > 200) {
    throw new HttpError(`A password needs at least ${MIN_PASSWORD} characters.`, 400, 'bad_password');
  }
  return input;
}

export async function listStaff(): Promise<{ staff: StaffAccount[] }> {
  return { staff: await rows<StaffAccount>('/rest/v1/user?select=id,email,user_name,role,created_at&order=created_at.asc') };
}

export async function createStaff(input: { email?: unknown; name?: unknown; password?: unknown; role?: unknown }) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new HttpError('Enter a valid email address.', 400, 'bad_email');
  if (!name || name.length > 80) throw new HttpError('Enter the person\'s name.', 400, 'bad_name');
  const password = checkedPassword(input.password);
  const role = input.role === 'admin' ? 'admin' : 'user';

  const res = await supabase('/rest/v1/rpc/staff_create_user', {
    method: 'POST',
    body: { p_email: email, p_name: name, p_password: password, p_role: role },
  });
  if (res.status === 409) throw new HttpError('There is already an account with that email.', 409, 'taken');
  if (!res.ok) {
    console.error('[staff] create failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('The account could not be created.', 502, 'db_failed');
  }
  return { id: (await res.json()) as string, email, name, role };
}

export async function setStaffPassword(input: { id?: unknown; password?: unknown }) {
  const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null;
  if (!id) throw new HttpError('Account not found.', 404, 'not_found');
  const password = checkedPassword(input.password);
  const res = await supabase('/rest/v1/rpc/staff_set_password', { method: 'POST', body: { p_id: id, p_password: password } });
  if (!res.ok) {
    console.error('[staff] password change failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('The password could not be changed.', 502, 'db_failed');
  }
  if ((await res.json()) !== true) throw new HttpError('Account not found.', 404, 'not_found');
  return { ok: true };
}
