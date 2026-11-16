import { getProfile, setProfileImage } from '../../../server/access';
import { readJson, route } from '../../../server/http';
import { requireSession } from '../../../server/session';

// GET  /api/access/profile -> { name, profile_image, created_at }
export const GET = route(async (request) => getProfile(await requireSession(request, 'access')));

// POST /api/access/profile { profile_image } -> { profile_image }
export const POST = route(async (request) => {
  const user = await requireSession(request, 'access');
  const body = await readJson<{ profile_image: string | null }>(request);
  return setProfileImage(user, body.profile_image ?? null);
});
