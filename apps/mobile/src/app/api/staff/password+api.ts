import { readJson, route } from '../../../server/http';
import { requireAdmin, setStaffPassword } from '../../../server/staffAdmin';

// POST /api/staff/password { id, password } -> { ok }   (admin only)
export const POST = route(async (request) => {
  await requireAdmin(request);
  return setStaffPassword(await readJson<{ id: string; password: string }>(request));
});
