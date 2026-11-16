import { HttpError } from './http';

// SERVER ONLY. Signed session tokens. After a correct PIN (or staff password)
// the server hands the app a token; every later call must carry it, and the
// server takes the person's name from the token, never from what the app says.

export interface SessionUser {
  kind: 'access' | 'staff';
  /** The link name, or the staff user's name. Receipts are saved under it. */
  name: string;
  role?: string;
}

interface Payload {
  k: 'a' | 's';
  n: string;
  r?: string;
  /** Expiry, seconds since 1970. */
  e: number;
}

const TOKEN_DAYS = 365;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function signature(data: string): Promise<string> {
  // SESSION_SECRET is optional; without it the key is derived from the service-role key,
  // which only the server holds.
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) throw new HttpError('Sign in is not configured on the server.', 503, 'not_configured');
  const key = await crypto.subtle.importKey('raw', encoder.encode(`lionrock-session-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
}

/** Compares two strings without stopping at the first difference. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueToken(user: SessionUser): Promise<string> {
  const payload: Payload = {
    k: user.kind === 'staff' ? 's' : 'a',
    n: user.name,
    ...(user.role ? { r: user.role } : {}),
    e: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 24 * 60 * 60,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await signature(body)}`;
}

export async function readSession(request: Request): Promise<SessionUser | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  if (!safeEqual(sig, await signature(body))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Payload;
    if (!payload.n || typeof payload.e !== 'number' || payload.e * 1000 < Date.now()) return null;
    return { kind: payload.k === 's' ? 'staff' : 'access', name: payload.n, role: payload.r };
  } catch {
    return null;
  }
}

/** The signed-in person, or a 401 that tells the app to sign in again. */
export async function requireSession(request: Request, kind?: SessionUser['kind']): Promise<SessionUser> {
  const user = await readSession(request);
  if (!user) throw new HttpError('Please sign in again.', 401, 'signed_out');
  if (kind && user.kind !== kind) throw new HttpError('This is not allowed for your account.', 403, 'forbidden');
  return user;
}
