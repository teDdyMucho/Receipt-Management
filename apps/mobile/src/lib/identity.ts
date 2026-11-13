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
  /** Staff session token (staff only). */
  token?: string;
  /** False when the name was accepted without a server check (no API configured). */
  verified: boolean;
}

const IDENTITY_KEY = 'receipts.identity';
const DEVICE_KEY = 'receipts.device_id';

export async function loadIdentity(): Promise<Identity | null> {
  const raw = await SecureStore.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Identity;
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
export const APP_VERSION = extra.appVersion ?? Constants.expoConfig?.version ?? '1.0.0';
