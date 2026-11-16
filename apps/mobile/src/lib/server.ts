import { Platform } from 'react-native';
import { getSetting, setSetting } from './db';
import { API_BASE_URL } from './identity';

// Where the app finds the server (AI reading and saving receipts).
// Order: the address typed in Settings, then the one baked into the build.
// In a browser an empty address is fine: the page and the server share an origin.

const KEY = 'server_url';

/** Headers for every call to our server. The app key is public by design (see src/server/guard.ts). */
export const SERVER_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(process.env.EXPO_PUBLIC_APP_KEY ? { 'X-App-Key': process.env.EXPO_PUBLIC_APP_KEY } : {}),
};

export function cleanServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export async function getServerBase(): Promise<string> {
  // EXPO_PUBLIC_DEFAULT_SERVER_URL is set when building a test APK that talks to a computer on the same Wi-Fi.
  return (await getSetting(KEY)) || process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL || API_BASE_URL;
}

export async function setServerBase(input: string): Promise<string> {
  const url = cleanServerUrl(input);
  await setSetting(KEY, url || null);
  return url;
}

/** Null when the server can be reached, otherwise the reason to show the user. */
export async function serverProblem(base: string): Promise<string | null> {
  if (!base && Platform.OS !== 'web') return 'No server address is set. Add it in Settings.';
  return null;
}

/** Checks that the address answers like our server. */
export async function testServer(base: string): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // An empty request must come back as a JSON "bad request" from our route.
    const res = await fetch(`${base}/api/extract`, {
      method: 'POST',
      headers: SERVER_HEADERS,
      body: '{}',
      signal: controller.signal,
    });
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    if (isJson && res.status === 400) return { ok: true, message: 'Connected to the server.' };
    return { ok: false, message: 'Something answered at that address, but it is not the Receipts server.' };
  } catch {
    return { ok: false, message: 'Could not reach that address. Check it, and that this phone is on the same Wi-Fi as the computer.' };
  } finally {
    clearTimeout(timer);
  }
}
