import { ExtractError, extractReceipt } from '../../server/extractReceipt';
import { rejectWithoutAppKey } from '../../server/guard';

// POST /api/extract  { contentType, base64 }  ->  { extracted_fields }
// Runs on the server (never in the app bundle). In production this moves behind
// the identity check as POST /api/receipts/{client_uuid}/extract.
export async function POST(request: Request): Promise<Response> {
  const rejected = rejectWithoutAppKey(request);
  if (rejected) return rejected;
  try {
    const body = (await request.json().catch(() => null)) as { contentType?: string; base64?: string } | null;
    if (!body?.contentType || !body.base64) {
      return Response.json({ error: 'contentType and base64 are required.', code: 'bad_request' }, { status: 400 });
    }
    const fields = await extractReceipt(body.contentType, body.base64);
    return Response.json({ extracted_fields: fields });
  } catch (e) {
    if (e instanceof ExtractError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error('[extract] unexpected error', e);
    return Response.json({ error: 'Extraction failed.', code: 'server_error' }, { status: 500 });
  }
}
