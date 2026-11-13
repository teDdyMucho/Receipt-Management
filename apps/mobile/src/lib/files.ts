import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';

export { formatBytes } from './format';

// Receipt files live in the app's private documents folder: receipts/<client_uuid>.<ext>
// (files.web.ts is the browser preview version of this file.)

function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** The file for a stored name, or null when it is missing (for example after cleanup). */
function receiptFile(localPath: string | null): File | null {
  if (!localPath) return null;
  const file = new File(receiptsDir(), localPath);
  return file.exists ? file : null;
}

export function receiptFileUri(localPath: string | null): string | null {
  return receiptFile(localPath)?.uri ?? null;
}

/** The stored file as base64, for AI extraction. */
export async function readReceiptBase64(localPath: string | null): Promise<string | null> {
  const file = receiptFile(localPath);
  return file ? file.base64() : null;
}

export async function fileSize(uri: string): Promise<number> {
  return new File(uri).size ?? 0;
}

/** Copies a processed file into the private folder and returns its stored name and size. */
export async function storeReceiptFile(sourceUri: string, clientUuid: string, ext: string) {
  const name = `${clientUuid}.${ext}`;
  const destination = new File(receiptsDir(), name);
  if (destination.exists) destination.delete();
  await new File(sourceUri).copy(destination);
  return { name, size: destination.size ?? 0, uri: destination.uri };
}

export function deleteReceiptFile(localPath: string | null): void {
  receiptFile(localPath)?.delete();
}

/** SHA-256 hex of the exact bytes that will be uploaded. */
export async function sha256OfFile(uri: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  const hash = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Bytes used by receipt files on this phone. */
export function storageUsedBytes(): number {
  let total = 0;
  for (const entry of receiptsDir().list()) {
    if (entry instanceof File) total += entry.size ?? 0;
  }
  return total;
}

/** Writes text to a temporary file and opens the share sheet. False when sharing is unavailable. */
export async function shareTextFile(name: string, text: string): Promise<boolean> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Send diagnostics' });
  return true;
}
