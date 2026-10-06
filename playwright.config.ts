import { defineConfig } from '@playwright/test';
const productionPreview = process.env.PLAYWRIGHT_PRODUCTION === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 4,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome', headless: true },
  webServer: { command: `npm run ${productionPreview ? 'preview' : 'dev'} -- --host 127.0.0.1 --port 4173 --strictPort`, url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI && !productionPreview },
});
