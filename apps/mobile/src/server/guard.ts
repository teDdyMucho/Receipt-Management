// SERVER ONLY. A first gate for the hosted API.
//
// When APP_SHARED_KEY is set on the server, every request must carry the same
// value in the X-App-Key header. The app gets it at build time, so this is not
// a secret: it only keeps casual traffic away from the AI and the database.
// Verified access names and staff sessions (spec section 6) are the real
// protection and must be in place before a public App Store release.
export function rejectWithoutAppKey(request: Request): Response | null {
  const expected = process.env.APP_SHARED_KEY;
  if (!expected) return null; // local development: open
  if (request.headers.get('x-app-key') === expected) return null;
  return Response.json({ error: 'Not allowed.', code: 'forbidden' }, { status: 401 });
}
