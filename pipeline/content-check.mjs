// npm run content:check — runs the content-check tests, then the checks, with the pipeline's own Python when it exists.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const win = process.platform === 'win32';
const venv = win ? 'pipeline/.venv/Scripts/python.exe' : 'pipeline/.venv/bin/python';
const python = existsSync(venv) ? venv : win ? 'python' : 'python3';
for (const script of ['pipeline/test_checks.py', 'pipeline/content_check.py', ...process.argv.slice(2)]) {
  const r = spawnSync(python, [script], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
