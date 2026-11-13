import type { ExtractedFields } from '@lionrock/shared';
import { getReceipt, saveExtracted } from './db';
import { readReceiptBase64 } from './files';
import { getServerBase, serverProblem } from './server';

// AI extraction (spec 4.9). Best effort: it never blocks saving, and if it
// fails or takes over 20 seconds the wizard simply opens empty, with the reason shown.

const TIMEOUT_MS = 20_000;
const EMPTY: ExtractedFields = { receipt_date: null, total: null, work_order: null, tenant_address: null };

export interface ExtractOutcome {
  /** What the AI read. All null when it read the receipt but found nothing. */
  fields: ExtractedFields | null;
  /** Why nothing could be read, when the attempt itself failed (it can be tried again). */
  reason: string | null;
}

export async function extractAndStore(clientUuid: string): Promise<ExtractOutcome> {
  const receipt = await getReceipt(clientUuid);
  if (!receipt) return { fields: null, reason: 'Receipt not found.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const base64 = await readReceiptBase64(receipt.local_path);
    if (!base64) return { fields: null, reason: 'The receipt file is no longer on this device.' };

    const server = await getServerBase();
    const problem = await serverProblem(server);
    if (problem) return { fields: null, reason: problem };

    const response = await fetch(`${server}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: receipt.content_type, base64 }),
      signal: controller.signal,
    });

    // A page instead of JSON means the AI route is not being served.
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) {
      const hint = __DEV__ ? ' Restart the app server: press Ctrl+C in the terminal, then run "npm run web".' : '';
      return { fields: null, reason: `AI reading is not available right now.${hint}` };
    }

    const data = (await response.json()) as { extracted_fields?: ExtractedFields | null; error?: string };
    if (!response.ok) return { fields: null, reason: data.error ?? 'AI reading failed.' };

    // Saved even when empty, so a receipt with nothing readable is not sent again on every open.
    const fields = data.extracted_fields ?? EMPTY;
    await saveExtracted(clientUuid, fields);
    return { fields, reason: null };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    return { fields: null, reason: timedOut ? 'Reading the receipt took too long.' : 'Could not reach the AI service.' };
  } finally {
    clearTimeout(timer);
  }
}
