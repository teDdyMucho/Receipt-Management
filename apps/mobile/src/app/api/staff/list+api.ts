import { route } from '../../../server/http';
import { listStaff, requireAdmin } from '../../../server/staffAdmin';

// GET /api/staff/list -> { staff }   (admin only)
export const GET = route(async (request) => {
  await requireAdmin(request);
  return listStaff();
});
