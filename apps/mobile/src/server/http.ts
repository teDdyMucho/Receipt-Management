import { rejectWithoutAppKey } from './guard';

// SERVER ONLY. Shared plumbing for the API routes: one error type and one wrapper
// that applies the app-key gate and turns errors into JSON answers.

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export function route(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    const rejected = rejectWithoutAppKey(request);
    if (rejected) return rejected;
    try {
      return Response.json(await handler(request));
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
      console.error('[api] unexpected error', e);
      return Response.json({ error: 'Something went wrong on the server.', code: 'server_error' }, { status: 500 });
    }
  };
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  const body = (await request.json().catch(() => null)) as Partial<T> | null;
  if (!body || typeof body !== 'object') throw new HttpError('A JSON body is required.', 400, 'bad_request');
  return body;
}
