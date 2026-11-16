import { checkName } from '../../../server/access';
import { readJson, route } from '../../../server/http';

// POST /api/access/check { name } -> { name, status: available | taken | disabled }
export const POST = route(async (request) => checkName((await readJson<{ name: string }>(request)).name));
