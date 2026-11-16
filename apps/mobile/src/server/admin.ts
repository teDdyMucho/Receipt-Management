import { HttpError } from './http';
import { isServiceRoleKey } from './saveReceipt';

// SERVER ONLY. Talks to Supabase with the service-role key. Sign in, PINs and
// reading other people's receipts all need it; there is no anon fallback here.

function config() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key || !isServiceRoleKey(key)) {
    throw new HttpError('The database is not configured on the server.', 503, 'not_configured');
  }
  return { url, key };
}

export function supabaseUrl(): string {
  return config().url;
}

/** One call to Supabase (REST, RPC or Storage). `path` starts with /rest/v1 or /storage/v1. */
export async function supabase(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<Response> {
  const { url, key } = config();
  const res = await fetch(`${url}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 404 || res.status === 400) {
    const detail = await res.clone().text();
    // The table, column or function is not there yet: a migration has not been run.
    if (/PGRST205|PGRST204|PGRST202|42P01|42703|42883/.test(detail)) {
      console.error('[admin] missing table, column or function', detail.slice(0, 200));
      throw new HttpError('The database is not set up for this yet. The office needs to run the latest setup SQL.', 503, 'not_ready');
    }
  }
  return res;
}

/** Reads rows, or throws a plain "database" error. */
export async function rows<T>(path: string): Promise<T[]> {
  const res = await supabase(path);
  if (!res.ok) {
    console.error('[admin] read failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('The database could not be read.', 502, 'db_failed');
  }
  return (await res.json()) as T[];
}
