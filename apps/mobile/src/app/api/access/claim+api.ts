import { claimName } from '../../../server/access';
import { readJson, route } from '../../../server/http';

// POST /api/access/claim { name, pin } -> { name, token, profile_image }
// Sets the PIN for a name nobody has used yet.
export const POST = route(async (request) => {
  const body = await readJson<{ name: string; pin: string }>(request);
  return claimName(body.name, body.pin);
});
