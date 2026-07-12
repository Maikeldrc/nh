import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/qa',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'qa-evidence/playwright-report', open: 'never' }],
    ['json', { outputFile: 'qa-evidence/logs/playwright-production-results.json' }]
  ],
  use: {
    baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } }
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }
    }
  ],
  outputDir: 'qa-evidence/playwright-artifacts'
});
