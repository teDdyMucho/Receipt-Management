import { changePin } from '../../../server/access';
import { readJson, route } from '../../../server/http';
import { requireSession } from '../../../server/session';

// POST /api/access/pin { current_pin, new_pin } -> { ok }
export const POST = route(async (request) => {
  const user = await requireSession(request, 'access');
  const body = await readJson<{ current_pin: string; new_pin: string }>(request);
  return changePin(user, body.current_pin, body.new_pin);
});
