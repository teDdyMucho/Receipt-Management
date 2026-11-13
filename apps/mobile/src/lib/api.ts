import { API_BASE_URL } from './identity';

// The only place the app talks to the network. It calls our API and nothing
// else: no Supabase key and no n8n URL exist in this app.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export const hasApi = API_BASE_URL.length > 0;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code ?? 'unknown');
  }
  return data as T;
}

export type VerifyResult =
  | { ok: true; displayName: string; verified: boolean }
  | { ok: false; message: string };

/**
 * Checks an access NAME with the server. Without an API configured (local
 * testing) the name is accepted as typed and marked unverified.
 */
export async function verifyAccessName(name: string): Promise<VerifyResult> {
  if (!hasApi) return { ok: true, displayName: name, verified: false };
  try {
    const data = await post<{ ok: boolean; display_name: string }>('/api/access/verify', { name });
    return { ok: true, displayName: data.display_name || name, verified: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 410) {
      return { ok: false, message: 'This access name is no longer active' };
    }
    if (e instanceof ApiError && e.status === 404) {
      return { ok: false, message: 'We could not find that access name. Check the spelling.' };
    }
    return { ok: false, message: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Sample staff account for the preview (no server). Not a real account. */
export const DEMO_STAFF = { email: 'demo@lionrock.test', password: 'demo1234', name: 'Demo Staff' };

export type LoginResult = { ok: true; name: string; token: string } | { ok: false; message: string };

export async function staffLogin(email: string, password: string): Promise<LoginResult> {
  // Preview only: with no API configured there is no server to check a password,
  // so one sample account is accepted. A build with an API URL never reaches this.
  if (!hasApi) {
    if (email.toLowerCase() === DEMO_STAFF.email && password === DEMO_STAFF.password) {
      return { ok: true, name: DEMO_STAFF.name, token: '' };
    }
    return { ok: false, message: 'Invalid email or password' };
  }
  try {
    const data = await post<{ token: string; user: { name: string } }>('/api/auth/login', {
      email,
      password,
      client: 'mobile',
    });
    return { ok: true, name: data.user.name, token: data.token };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { ok: false, message: 'Invalid email or password' };
    return { ok: false, message: 'Could not reach the server. Check your connection and try again.' };
  }
}
