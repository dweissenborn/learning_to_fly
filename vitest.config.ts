import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/**/*.test.ts', 'api/test/*.test.js', 'apps/web/src/**/*.test.ts', 'modules/**/*.test.ts'] } });
