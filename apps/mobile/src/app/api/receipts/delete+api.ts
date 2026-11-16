import { readJson, route } from '../../../server/http';
import { deleteReceipt } from '../../../server/receiptAdmin';
import { requireSession } from '../../../server/session';

// POST /api/receipts/delete { id } -> { ok }
// A link name can delete only its own receipts; staff can delete any.
export const POST = route(async (request) => {
  const user = await requireSession(request);
  return deleteReceipt(user, (await readJson<{ id: string }>(request)).id);
});
