import type { ReceiptDetails } from '@lionrock/shared';
import { readJson, route } from '../../../server/http';
import { updateReceipt } from '../../../server/receiptAdmin';
import { requireSession } from '../../../server/session';

// POST /api/receipts/update { id, details } -> { ok, changed }   (staff and admins)
export const POST = route(async (request) => {
  const user = await requireSession(request, 'staff');
  const body = await readJson<{ id: string; details: Partial<ReceiptDetails> }>(request);
  return updateReceipt(user, body.id, body.details);
});
