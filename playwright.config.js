import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.PW_PORT || 4317);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: `http://127.0.0.1:${port}/sharky_the_claw/`, trace: 'on-first-retry' },
  webServer: {
    command: `VITE_E2E=1 npm run build && PORT=${port} node scripts/serve-dist.js`,
    url: `http://127.0.0.1:${port}/sharky_the_claw/`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: /smoke\.spec\.js/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: /smoke\.spec\.js/, use: { ...devices['Desktop Safari'] } },
  ],
});
