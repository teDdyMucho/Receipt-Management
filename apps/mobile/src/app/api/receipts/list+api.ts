import { route } from '../../../server/http';
import { listReceipts } from '../../../server/listReceipts';
import { requireSession } from '../../../server/session';

// GET /api/receipts/list[?person=NAME] -> { receipts, people }
// A link name gets only its own receipts. Staff get everyone's, or one person's.
export const GET = route(async (request) => {
  const user = await requireSession(request);
  return listReceipts(user, new URL(request.url).searchParams.get('person'));
});
