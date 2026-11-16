import { readJson, route } from '../../../server/http';
import { staffLogin } from '../../../server/staffAuth';

// POST /api/auth/login { email, password } -> { name, role, token }
export const POST = route(async (request) => {
  const body = await readJson<{ email: string; password: string }>(request);
  return staffLogin(body.email, body.password);
});
