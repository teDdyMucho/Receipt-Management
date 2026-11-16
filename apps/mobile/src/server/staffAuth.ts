import { supabase } from './admin';
import { HttpError } from './http';
import { issueToken } from './session';

// SERVER ONLY. Staff sign in with email and password, checked by the database
// function login_user (bcrypt). Staff can see every person's receipts.

interface StaffRow {
  email: string;
  user_name: string | null;
  role: string | null;
}

export async function staffLogin(emailInput: unknown, passwordInput: unknown) {
  const email = typeof emailInput === 'string' ? emailInput.trim() : '';
  const password = typeof passwordInput === 'string' ? passwordInput : '';
  if (!email || !password) throw new HttpError('Enter your email and password.', 400, 'bad_request');

  const res = await supabase('/rest/v1/rpc/login_user', { method: 'POST', body: { p_email: email, p_password: password } });
  if (!res.ok) {
    console.error('[staff] login failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('Staff sign in is not available right now.', 502, 'db_failed');
  }
  const user = ((await res.json()) as StaffRow[])[0];
  if (!user) throw new HttpError('Invalid email or password', 401, 'bad_login');

  const name = user.user_name?.trim() || user.email;
  const role = user.role ?? 'user';
  return { name, role, token: await issueToken({ kind: 'staff', name, role }) };
}
