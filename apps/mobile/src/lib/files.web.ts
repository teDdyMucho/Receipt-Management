export { formatBytes } from './format';

// Browser preview version of files.ts. Receipt files are kept as data URLs in
// memory and, while there is room, in the browser's local storage (about 5 MB,
// so only a handful of receipts survive a page reload). The phone app stores
// real files and has no such limit.

const PREFIX = 'receipts.file.';
const memory = new Map<string, string>();

function read(name: string): string | null {
  const cached = memory.get(name);
  if (cached) return cached;
  try {
    const stored = globalThis.localStorage?.getItem(PREFIX + name) ?? null;
    if (stored) memory.set(name, stored);
    return stored;
  } catch {
    return null;
  }
}

async function toBlob(uri: string): Promise<Blob> {
  return (await fetch(uri)).blob();
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}

export function receiptFileUri(localPath: string | null): string | null {
  return localPath ? read(localPath) : null;
}

/** The stored file as base64, for AI extraction. */
export async function readReceiptBase64(localPath: string | null): Promise<string | null> {
  const dataUrl = localPath ? read(localPath) : null;
  return dataUrl ? (dataUrl.split(',')[1] ?? null) : null;
}

export async function fileSize(uri: string): Promise<number> {
  return (await toBlob(uri)).size;
}

export async function storeReceiptFile(sourceUri: string, clientUuid: string, ext: string) {
  const name = `${clientUuid}.${ext}`;
  const blob = await toBlob(sourceUri);
  const dataUrl = await toDataUrl(blob);
  memory.set(name, dataUrl);
  try {
    globalThis.localStorage?.setItem(PREFIX + name, dataUrl);
  } catch {
    // local storage is full: the file stays available until the page is reloaded
  }
  return { name, size: blob.size, uri: dataUrl };
}

export function deleteReceiptFile(localPath: string | null): void {
  if (!localPath) return;
  memory.delete(localPath);
  try {
    globalThis.localStorage?.removeItem(PREFIX + localPath);
  } catch {
    // nothing to remove
  }
}

export async function sha256OfFile(uri: string): Promise<string> {
  const bytes = await (await toBlob(uri)).arrayBuffer();
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function storageUsedBytes(): number {
  let total = 0;
  try {
    const ls = globalThis.localStorage;
    for (let i = 0; i < (ls?.length ?? 0); i += 1) {
      const key = ls.key(i);
      if (key?.startsWith(PREFIX)) total += Math.round(((ls.getItem(key) ?? '').length * 3) / 4);
    }
  } catch {
    // ignore
  }
  return total;
}

/** Downloads the text as a file. */
export async function shareTextFile(name: string, text: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
