import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // A suíte compartilha um banco E2E; workers paralelos causam corridas entre specs.
  workers: 1,
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
