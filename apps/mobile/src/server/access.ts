import { isValidLinkName } from '@lionrock/shared';
import { rows, supabase } from './admin';
import { HttpError } from './http';
import { issueToken, safeEqual, type SessionUser } from './session';

// SERVER ONLY. Link names with a PIN.
// The first person to use a name sets its PIN and owns it. Anyone else who
// types that name is told it is not available; the owner gets back in with the PIN.

interface Account {
  name_key: string;
  link_name: string;
  pin_hash: string;
  pin_salt: string;
  pin_failed_count: number;
  pin_locked_until: string | null;
  profile_image: string | null;
  disabled_at: string | null;
  created_at: string;
}

const TABLE = '/rest/v1/receipt_link_accounts';
const MAX_NAME = 60;
const MAX_WRONG_PINS = 5;
const LOCK_MINUTES = 15;
const MAX_IMAGE_LENGTH = 200_000;
export const TAKEN_MESSAGE = 'This link is not available. Please use another name.';
const DISABLED_MESSAGE = 'This access name is no longer active';

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ');
const keyOf = (name: string) => tidy(name).toLowerCase();
const byKey = (key: string) => `${TABLE}?name_key=eq.${encodeURIComponent(key)}`;

function checkedName(input: unknown): string {
  const name = typeof input === 'string' ? tidy(input) : '';
  if (!name || name.length > MAX_NAME || !isValidLinkName(name)) {
    throw new HttpError('Enter a name with at least one letter or number.', 400, 'bad_name');
  }
  return name;
}

function checkedPin(input: unknown): string {
  if (typeof input !== 'string' || !/^\d{4,6}$/.test(input)) {
    throw new HttpError('A PIN is 4 to 6 numbers.', 400, 'bad_pin');
  }
  return input;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(saltHex), iterations: 100_000 }, key, 256);
  return hex(new Uint8Array(bits));
}

async function newPin(pin: string): Promise<{ pin_hash: string; pin_salt: string }> {
  const pin_salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { pin_hash: await hashPin(pin, pin_salt), pin_salt };
}

async function findAccount(key: string): Promise<Account | null> {
  return (await rows<Account>(`${byKey(key)}&select=*`))[0] ?? null;
}

/** The office can switch a link off in receipt_access_links; that also blocks the account. */
async function officeDisabled(key: string): Promise<boolean> {
  const disabled = await rows<{ link_name: string | null }>('/rest/v1/receipt_access_links?disabled_at=not.is.null&select=link_name');
  return disabled.some((row) => keyOf(row.link_name ?? '') === key);
}

async function patch(key: string, values: Partial<Account>): Promise<void> {
  const res = await supabase(byKey(key), { method: 'PATCH', body: values });
  if (!res.ok) {
    console.error('[access] update failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('The change could not be saved.', 502, 'db_failed');
  }
}

/** Throws unless the PIN is right. Five wrong PINs lock the name for 15 minutes. */
async function verifyPin(account: Account, pin: string): Promise<void> {
  const lockedUntil = account.pin_locked_until ? new Date(account.pin_locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60_000));
    throw new HttpError(`Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 429, 'locked');
  }
  if (safeEqual(await hashPin(pin, account.pin_salt), account.pin_hash)) {
    if (account.pin_failed_count > 0) await patch(account.name_key, { pin_failed_count: 0, pin_locked_until: null });
    return;
  }
  const wrong = account.pin_failed_count + 1;
  if (wrong >= MAX_WRONG_PINS) {
    await patch(account.name_key, { pin_failed_count: 0, pin_locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() });
    throw new HttpError(`Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.`, 429, 'locked');
  }
  await patch(account.name_key, { pin_failed_count: wrong });
  throw new HttpError('Wrong PIN.', 401, 'wrong_pin');
}

async function signedIn(account: Pick<Account, 'link_name' | 'profile_image'>) {
  return {
    name: account.link_name,
    token: await issueToken({ kind: 'access', name: account.link_name }),
    profile_image: account.profile_image,
  };
}

/** Step 1 of the welcome screen: can this name be set up, or is it someone's already? */
export async function checkName(input: unknown): Promise<{ name: string; status: 'available' | 'taken' | 'disabled' }> {
  const name = checkedName(input);
  const key = keyOf(name);
  const account = await findAccount(key);
  if (account?.disabled_at || (await officeDisabled(key))) return { name, status: 'disabled' };
  return account ? { name: account.link_name, status: 'taken' } : { name, status: 'available' };
}

/** Sets the PIN for a name nobody has used yet. */
export async function claimName(nameInput: unknown, pinInput: unknown) {
  const name = checkedName(nameInput);
  const pin = checkedPin(pinInput);
  const key = keyOf(name);
  if (await officeDisabled(key)) throw new HttpError(DISABLED_MESSAGE, 410, 'disabled');

  // name_key is the primary key, so two phones claiming the same name cannot both win.
  const res = await supabase(TABLE, {
    method: 'POST',
    body: { name_key: key, link_name: name, ...(await newPin(pin)) },
    prefer: 'return=minimal',
  });
  if (res.status === 409) throw new HttpError(TAKEN_MESSAGE, 409, 'taken');
  if (!res.ok) {
    console.error('[access] claim failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('The name could not be set up. Try again.', 502, 'db_failed');
  }
  return signedIn({ link_name: name, profile_image: null });
}

/** The owner of a name coming back (new phone, or after signing out). */
export async function loginName(nameInput: unknown, pinInput: unknown) {
  const key = keyOf(checkedName(nameInput));
  const pin = checkedPin(pinInput);
  const account = await findAccount(key);
  if (!account) throw new HttpError('We could not find that name.', 404, 'not_found');
  if (account.disabled_at || (await officeDisabled(key))) throw new HttpError(DISABLED_MESSAGE, 410, 'disabled');
  await verifyPin(account, pin);
  await patch(key, { last_login_at: new Date().toISOString() } as Partial<Account>);
  return signedIn(account);
}

async function ownAccount(user: SessionUser): Promise<Account> {
  const account = user.kind === 'access' ? await findAccount(keyOf(user.name)) : null;
  if (!account || account.disabled_at) throw new HttpError('Please sign in again.', 401, 'signed_out');
  return account;
}

export async function getProfile(user: SessionUser) {
  const account = await ownAccount(user);
  return { name: account.link_name, profile_image: account.profile_image, created_at: account.created_at };
}

export async function changePin(user: SessionUser, currentInput: unknown, nextInput: unknown) {
  const account = await ownAccount(user);
  if (typeof currentInput !== 'string' || !currentInput) throw new HttpError('Enter your current PIN.', 400, 'bad_pin');
  const next = checkedPin(nextInput);
  await verifyPin(account, currentInput);
  await patch(account.name_key, await newPin(next));
  return { ok: true };
}

/**
 * The person deletes their own account from inside the app (the app stores ask for this).
 * The PIN and the picture are erased and nobody can sign in with the name again.
 * The name itself stays reserved: receipts are filed under it, so letting someone
 * else take the name would hand them the previous person's receipts.
 */
export async function deleteAccount(user: SessionUser, pinInput: unknown) {
  const account = await ownAccount(user);
  if (typeof pinInput !== 'string' || !pinInput) throw new HttpError('Enter your PIN.', 400, 'bad_pin');
  await verifyPin(account, pinInput);
  await patch(account.name_key, {
    pin_hash: '',
    pin_salt: '',
    profile_image: null,
    pin_failed_count: 0,
    pin_locked_until: null,
    disabled_at: new Date().toISOString(),
  });
  return { ok: true };
}

/** `image` is a small JPEG or PNG as a data URL, or null to remove the picture. */
export async function setProfileImage(user: SessionUser, image: unknown) {
  const account = await ownAccount(user);
  if (image !== null) {
    if (typeof image !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE_LENGTH) {
      throw new HttpError('That picture cannot be used. Choose another one.', 400, 'bad_image');
    }
  }
  await patch(account.name_key, { profile_image: image });
  return { profile_image: image };
}
