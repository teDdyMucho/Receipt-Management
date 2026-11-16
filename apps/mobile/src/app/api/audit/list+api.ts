import { route } from '../../../server/http';
import { listAudit } from '../../../server/receiptAdmin';
import { requireAdmin } from '../../../server/staffAdmin';

// GET /api/audit/list -> { entries }   (admin only)
export const GET = route(async (request) => {
  await requireAdmin(request);
  return listAudit();
});
