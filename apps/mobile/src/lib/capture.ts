import * as Crypto from 'expo-crypto';
import { insertReceipt } from './db';
import { deleteReceiptFile, sha256OfFile, storeReceiptFile } from './files';
import { processImage } from './imageProcessing';

// Capture and save locally first (spec 4.1). Nothing here touches the network:
// a receipt saved in airplane mode is as safe as one saved online.

export interface PickedFile {
  uri: string;
  kind: 'image' | 'pdf';
  /** Image size in pixels; unused for PDFs. */
  width: number;
  height: number;
  fromCamera: boolean;
  fileName?: string | null;
}

/** Default 8 MB; larger files are refused on the phone before queuing. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class FileTooLargeError extends Error {}

/** Stages of saving a receipt, in order. The loading screen shows them. */
export const SAVE_STEPS = ['Preparing the photo', 'Saving on this phone', 'Checking the file'];

/**
 * Processes the file, copies it into private storage, computes its checksum
 * and inserts the local row with sync_status = pending. Returns the new id.
 */
export async function saveReceiptLocally(
  picked: PickedFile,
  identity: string,
  rotation: number,
  onStep: (index: number) => void = () => undefined,
): Promise<string> {
  const clientUuid = Crypto.randomUUID();
  const takenAt = new Date().toISOString();

  let sourceUri = picked.uri;
  let ext = 'pdf';
  let contentType = 'application/pdf';

  onStep(0);
  if (picked.kind === 'image') {
    const processed = await processImage({
      uri: picked.uri,
      width: picked.width,
      height: picked.height,
      rotation,
      fromCamera: picked.fromCamera,
    });
    sourceUri = processed.uri;
    ext = 'jpg';
    contentType = 'image/jpeg';
  }

  onStep(1);
  const stored = await storeReceiptFile(sourceUri, clientUuid, ext);
  if (stored.size > MAX_UPLOAD_BYTES) {
    deleteReceiptFile(stored.name);
    throw new FileTooLargeError('This file is too large to upload (over 8 MB). Try a smaller file or a photo.');
  }

  onStep(2);
  const checksum = await sha256OfFile(stored.uri);
  const fileName =
    picked.kind === 'pdf' && picked.fileName ? picked.fileName : `receipt-${takenAt.replace(/[:.]/g, '-')}.${ext}`;

  await insertReceipt({
    client_uuid: clientUuid,
    identity,
    local_path: stored.name,
    file_name: fileName,
    content_type: contentType,
    file_size: stored.size,
    checksum_sha256: checksum,
    taken_at: takenAt,
  });
  return clientUuid;
}
