import { defineConfig } from '@playwright/test';

// End-to-end and accessibility checks. Uses the installed Microsoft Edge, so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5174', channel: 'msedge', viewport: { width: 1280, height: 800 } },
  webServer: { command: 'npm run dev -w apps/web -- --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false },
});
