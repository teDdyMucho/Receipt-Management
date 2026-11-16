// Copies the server settings from .env.local to your Expo (EAS) account, into the
// "production" and "preview" environments, so the hosted server and the store
// builds can use them. Run it yourself from apps/mobile:
//
//   node scripts/push-env-to-eas.mjs
//
// It sends: the OpenAI key, the Supabase URL, the Supabase service-role key and
// the app key. Values are never printed.
import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const ENV_FILE = '.env.local';
const read = () =>
  Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^\s*([A-Za-z_0-9]+)\s*=\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );

// The app key is made once and kept in .env.local so local runs and the hosted server agree.
let env = read();
if (!env.APP_SHARED_KEY) {
  const key = randomBytes(24).toString('hex');
  appendFileSync(
    ENV_FILE,
    `\n# First gate for the hosted server (see src/server/guard.ts). The EXPO_PUBLIC copy is public by design.\nAPP_SHARED_KEY=${key}\nEXPO_PUBLIC_APP_KEY=${key}\n`,
  );
  env = read();
  console.log('Made a new app key and saved it in .env.local');
}

const vars = [
  ['OPENAI_API_KEY', env.OPENAI_API_KEY, 'secret'],
  ['OPENAI_MODEL', env.OPENAI_MODEL || 'gpt-5-mini', 'plaintext'],
  ['SUPABASE_URL', env.SUPABASE_URL || env.VITE_SUPABASE_URL, 'plaintext'],
  ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY, 'secret'],
  ['APP_SHARED_KEY', env.APP_SHARED_KEY, 'secret'],
  ['EXPO_PUBLIC_APP_KEY', env.EXPO_PUBLIC_APP_KEY, 'plaintext'],
];

let failed = 0;
for (const [name, value, visibility] of vars) {
  if (!value) {
    console.log(`${name}: missing in ${ENV_FILE}, skipped`);
    failed += 1;
    continue;
  }
  const result = spawnSync(
    'npx',
    ['eas-cli@latest', 'env:create', '--name', name, '--value', `"${value}"`, '--visibility', visibility,
      '--environment', 'production', '--environment', 'preview', '--scope', 'project', '--force', '--non-interactive'],
    { shell: true, encoding: 'utf8' },
  );
  if (result.status === 0) {
    console.log(`${name}: saved`);
  } else {
    failed += 1;
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replaceAll(value, '***');
    console.log(`${name}: FAILED\n${output.trim().split(/\r?\n/).slice(-4).join('\n')}`);
  }
}
process.exit(failed ? 1 : 0);
