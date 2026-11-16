import { route } from '../../../server/http';
import { receiptFileUrl } from '../../../server/listReceipts';
import { requireSession } from '../../../server/session';

// GET /api/receipts/file?id=RECEIPT_ID -> { url, content_type }  (the url works for five minutes)
export const GET = route(async (request) => {
  const user = await requireSession(request);
  return receiptFileUrl(user, new URL(request.url).searchParams.get('id'));
});
