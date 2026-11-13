// Fails when any source file in the repo is longer than 500 lines (spec section 3).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MAX_LINES = 500;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.netlify', '.expo', 'ios', 'android']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sql', '.css']);

const tooLong = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (EXTENSIONS.has(extname(name))) {
      const lines = readFileSync(full, 'utf8').split('\n').length;
      if (lines > MAX_LINES) tooLong.push(`${full} (${lines} lines)`);
    }
  }
}

walk(process.cwd());

if (tooLong.length > 0) {
  console.error(`Files over ${MAX_LINES} lines:\n${tooLong.join('\n')}`);
  process.exit(1);
}
console.log(`OK: no file over ${MAX_LINES} lines.`);
