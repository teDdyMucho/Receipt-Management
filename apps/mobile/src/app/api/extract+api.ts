import { ExtractError, extractReceipt } from '../../server/extractReceipt';
import { HttpError, readJson, route } from '../../server/http';
import { requireSession } from '../../server/session';

// POST /api/extract  { contentType, base64 }  ->  { extracted_fields }
// Runs on the server (never in the app bundle). Only for someone who is signed in.
export const POST = route(async (request) => {
  await requireSession(request);
  const body = await readJson<{ contentType: string; base64: string }>(request);
  if (!body.contentType || !body.base64) throw new HttpError('contentType and base64 are required.', 400, 'bad_request');
  try {
    return { extracted_fields: await extractReceipt(body.contentType, body.base64) };
  } catch (e) {
    if (e instanceof ExtractError) throw new HttpError(e.message, e.status, e.code);
    throw e;
  }
});
