import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL: 'http://127.0.0.1:5000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run test:server',
    url: 'http://127.0.0.1:5000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
