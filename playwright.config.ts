import { defineConfig } from '@playwright/test';

// End-to-end and accessibility checks. Set E2E_URL to run them against a deployed site instead of a local server.
const url = process.env.E2E_URL;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // Locally this uses the installed Microsoft Edge; in CI it uses Playwright's own Chromium.
  use: { baseURL: url ?? 'http://localhost:5174', channel: process.env.CI ? undefined : 'msedge', viewport: { width: 1280, height: 800 } },
  webServer: url ? undefined : { command: 'npm run dev -w apps/web -- --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false },
});
