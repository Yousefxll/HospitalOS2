import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for SYRA E2E Tests
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  // Global setup: seed test data
  globalSetup: require.resolve('./__tests__/e2e/global-setup.ts'),

  projects: [
    {
      name: 'chromium-ui-crawl',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /ui-crawl\.spec\.ts/,
      fullyParallel: false, // Sequential for UI crawl to avoid server overload
      workers: 1, // Single worker for UI crawl
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /^(?!.*ui-crawl).*\.spec\.ts$/, // All other tests
    },
    // Uncomment for additional browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
