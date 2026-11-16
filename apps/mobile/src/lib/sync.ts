import { hasExhaustedRetries, nextRetryAt } from '@lionrock/shared';
import { Platform } from 'react-native';
import { addEvent, getReceipt, listReceipts, updateSync } from './db';
import { readReceiptBase64 } from './files';
import { APP_VERSION, getDeviceId } from './identity';
import { SERVER_HEADERS, getServerBase, serverProblem } from './server';

// Sends receipts to the server. A receipt becomes Synced on this device only
// after the server confirms it with the same checksum (spec 4.5).
//
// This is the direct path: it runs after the wizard and on "Sync now". The
// background queue (uploads while the app is closed, automatic timed retries)
// is Phase 3.

export interface SyncResult {
  started: boolean;
  message: string;
}

const inFlight = new Set<string>();

/** Uploads one receipt. Returns true when the server confirmed it. */
export async function syncReceipt(clientUuid: string): Promise<boolean> {
  if (inFlight.has(clientUuid)) return false;
  const receipt = await getReceipt(clientUuid);
  if (!receipt || receipt.sync_status === 'synced') return receipt?.sync_status === 'synced';

  inFlight.add(clientUuid);
  await updateSync(clientUuid, { sync_status: 'uploading' });
  try {
    const base64 = await readReceiptBase64(receipt.local_path);
    if (!base64) throw new Error('The receipt file is missing on this device.');

    const server = await getServerBase();
    const problem = await serverProblem(server);
    if (problem) throw new Error(problem);

    const response = await fetch(`${server}/api/receipts/save`, {
      method: 'POST',
      headers: SERVER_HEADERS,
      body: JSON.stringify({
        client_uuid: receipt.client_uuid,
        identity: receipt.identity,
        device_id: await getDeviceId(),
        app_version: APP_VERSION,
        platform: Platform.OS,
        taken_at: receipt.taken_at,
        file_name: receipt.file_name,
        content_type: receipt.content_type,
        file_size: receipt.file_size,
        checksum_sha256: receipt.checksum_sha256,
        details: receipt.details,
        details_confirmed: receipt.details_confirmed,
        extracted: receipt.extracted,
        base64,
      }),
    });

    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) throw new Error('The server is not answering. Restart it and try again.');
    const data = (await response.json()) as { receipt_id?: string; checksum?: string; status?: string; error?: string };
    if (!response.ok) throw new Error(data.error ?? `Save failed (${response.status})`);
    if (data.status !== 'synced' || data.checksum !== receipt.checksum_sha256) {
      throw new Error('The server did not confirm the receipt.');
    }

    await updateSync(clientUuid, {
      sync_status: 'synced',
      registered: true,
      server_receipt_id: data.receipt_id ?? null,
      synced_at: new Date().toISOString(),
      last_error: null,
      next_retry_at: null,
    });
    await addEvent(clientUuid, 'On server');
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    const attempts = receipt.attempts + 1;
    const failed = hasExhaustedRetries(attempts);
    await updateSync(clientUuid, {
      sync_status: failed ? 'failed' : 'pending',
      attempts,
      last_error: message,
      next_retry_at: failed ? null : nextRetryAt(attempts),
    });
    await addEvent(clientUuid, `Upload failed: ${message}`);
    return false;
  } finally {
    inFlight.delete(clientUuid);
  }
}

/** "Sync now": tries every receipt of this identity that is not on the server yet, oldest first. */
export async function syncNow(identity: string | null | undefined): Promise<SyncResult> {
  if (!identity) return { started: false, message: 'Choose who is scanning first.' };
  const waiting = (await listReceipts(identity))
    .filter((r) => r.sync_status === 'pending' || r.sync_status === 'failed')
    .sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  if (waiting.length === 0) return { started: false, message: 'Nothing is waiting to upload.' };

  let done = 0;
  for (const receipt of waiting) {
    if (await syncReceipt(receipt.client_uuid)) done += 1;
  }
  const left = waiting.length - done;
  return {
    started: true,
    message: left === 0 ? `${done} receipt${done === 1 ? '' : 's'} uploaded.` : `${done} uploaded, ${left} could not upload. Open a receipt to see why.`,
  };
}
