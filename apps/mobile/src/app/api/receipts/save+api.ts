import { HttpError, readJson, route } from '../../../server/http';
import { auditUpload } from '../../../server/receiptAdmin';
import { SaveError, saveReceipt, type SaveReceiptInput } from '../../../server/saveReceipt';
import { requireSession } from '../../../server/session';

// POST /api/receipts/save  -> { client_uuid, receipt_id, checksum, status: "synced" }
// Runs on the server. Confirms only after the file and the row are both saved.
export const POST = route(async (request) => {
  const user = await requireSession(request);
  const body = (await readJson<SaveReceiptInput>(request)) as SaveReceiptInput;
  // The receipt is saved under the signed-in name, never under a name the app sends.
  if (body.identity && body.identity.trim().toLowerCase() !== user.name.toLowerCase()) {
    throw new HttpError(`This receipt belongs to "${body.identity}". Sign in with that name to upload it.`, 403, 'wrong_identity');
  }
  try {
    const saved = await saveReceipt({ ...body, identity: user.name });
    await auditUpload(user, saved.receipt_id, body.details);
    return saved;
  } catch (e) {
    if (e instanceof SaveError) throw new HttpError(e.message, e.status, e.code);
    throw e;
  }
});
