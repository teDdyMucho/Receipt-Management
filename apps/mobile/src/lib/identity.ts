import * as Crypto from 'expo-crypto';
import * as SecureStore from './secureStorage';
import Constants from 'expo-constants';

// Who is scanning: an access NAME (field staff and vendors) or a signed-in staff
// user. Kept in the device keychain so it survives app updates.

export type IdentityKind = 'access' | 'staff';

export interface Identity {
  kind: IdentityKind;
  /** The access NAME, or the staff user name. Receipts are saved under this. */
  name: string;
  /** Session token from the server, given after the right PIN or staff password. */
  token: string;
  /** Staff role (staff only). */
  role?: string;
}

const IDENTITY_KEY = 'receipts.identity';
const DEVICE_KEY = 'receipts.device_id';

export async function loadIdentity(): Promise<Identity | null> {
  const raw = await SecureStore.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    const identity = JSON.parse(raw) as Identity;
    // An identity saved before PINs existed has no token: the person signs in again.
    return identity.token ? identity : null;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: Identity): Promise<void> {
  await SecureStore.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export async function clearIdentity(): Promise<void> {
  await SecureStore.deleteItem(IDENTITY_KEY);
}

/** A random id made once per install; the office sees it in the Sync tab. */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItem(DEVICE_KEY, id);
  return id;
}

interface Extra {
  apiBaseUrl?: string;
  appVersion?: string;
}
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const API_BASE_URL = (extra.apiBaseUrl ?? '').replace(/\/+$/, '');
// The version in app.config.ts is the real one (it is what the stores show).
export const APP_VERSION = Constants.expoConfig?.version ?? extra.appVersion ?? '1.0.0';
