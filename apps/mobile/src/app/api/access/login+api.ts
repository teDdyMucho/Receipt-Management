import { loginName } from '../../../server/access';
import { readJson, route } from '../../../server/http';

// POST /api/access/login { name, pin } -> { name, token, profile_image }
export const POST = route(async (request) => {
  const body = await readJson<{ name: string; pin: string }>(request);
  return loginName(body.name, body.pin);
});
