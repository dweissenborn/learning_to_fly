// ADR-0003: an extension module plugs in through its manifest only. The core imports nothing of a module but its manifest
// (in modules.ts), and a module imports nothing of the app but the host surface.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter((f) => f.isFile() && /\.tsx?$/.test(f.name)).map((f) => `${f.parentPath}/${f.name}`);
const imports = (f: string) => [...readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
const modules = readdirSync('modules', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe('extension boundary', () => {
  it('the core imports only a module manifest, and only in the registry', () => {
    const bad = ['apps/web/src', 'packages/engine/src'].flatMap(files).flatMap((f) => imports(f)
      .filter((i) => modules.some((m) => i.startsWith(`@wayfinder/${m}`)) && !(f.endsWith('modules.ts') && modules.includes(i.slice('@wayfinder/'.length))))
      .map((i) => `${f}: ${i}`));
    expect(bad).toEqual([]);
  });
  it('a module imports only the host surface of the app', () => {
    const bad = modules.flatMap((m) => files(`modules/${m}/src`)).flatMap((f) => imports(f)
      .filter((i) => (i.startsWith('@wayfinder/web') && i !== '@wayfinder/web/host') || i.includes('apps/web'))
      .map((i) => `${f}: ${i}`));
    expect(bad).toEqual([]);
  });
});
