// End-to-end tests at phone and desktop sizes.
// Local: starts the dev server on port 3100.  Production: BASE_URL=https://… npm run test:e2e
import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;
const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL || `http://localhost:${PORT}`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: BASE_URL
    ? undefined
    : {
        command: 'node --env-file-if-exists=.env.local scripts/dev-server.js',
        url: `http://localhost:${PORT}/api/health`,
        env: { PORT: String(PORT) },
        reuseExistingServer: false,
      },
});
