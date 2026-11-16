import { rejectWithoutAppKey } from '../../../server/guard';
import { SaveError, saveReceipt, type SaveReceiptInput } from '../../../server/saveReceipt';

// POST /api/receipts/save  -> { client_uuid, receipt_id, checksum, status: "synced" }
// Runs on the server. Confirms only after the file and the row are both saved.
export async function POST(request: Request): Promise<Response> {
  const rejected = rejectWithoutAppKey(request);
  if (rejected) return rejected;
  try {
    const body = (await request.json().catch(() => null)) as SaveReceiptInput | null;
    if (!body) return Response.json({ error: 'A JSON body is required.', code: 'bad_request' }, { status: 400 });
    return Response.json(await saveReceipt(body));
  } catch (e) {
    if (e instanceof SaveError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
    console.error('[save] unexpected error', e);
    return Response.json({ error: 'The receipt could not be saved.', code: 'server_error' }, { status: 500 });
  }
}
