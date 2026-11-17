import { deleteAccount } from '../../../server/access';
import { readJson, route } from '../../../server/http';
import { requireSession } from '../../../server/session';

// POST /api/access/delete { pin } -> { ok }
// The signed-in link name deletes its own account. The PIN is asked again so a
// borrowed phone cannot do it.
export const POST = route(async (request) => {
  const user = await requireSession(request, 'access');
  return deleteAccount(user, (await readJson<{ pin: string }>(request)).pin);
});
