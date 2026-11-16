import { readJson, route } from '../../../server/http';
import { createStaff, requireAdmin } from '../../../server/staffAdmin';

// POST /api/staff/create { email, name, password, role } -> { id, email, name, role }   (admin only)
export const POST = route(async (request) => {
  await requireAdmin(request);
  return createStaff(await readJson<{ email: string; name: string; password: string; role: string }>(request));
});
