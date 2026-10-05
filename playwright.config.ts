import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 4,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
