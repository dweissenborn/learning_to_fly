// Fails the build if any script is missing from the offline cache (for example when the content bank outgrows
// workbox's maximumFileSizeToCacheInBytes in vite.config.ts): the app must work with no connection.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const missing = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js') && !sw.includes(f));
if (missing.length) {
  console.error(`Not cached for offline use: ${missing.join(', ')}. Raise maximumFileSizeToCacheInBytes in apps/web/vite.config.ts.`);
  process.exit(1);
}
console.log('OK: every script is cached for offline use.');
