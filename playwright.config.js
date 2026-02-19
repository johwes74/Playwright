// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './playwright-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node demo-app/server.js',
    // Use an explicit IPv4 address instead of 'localhost' so Playwright's HTTP
    // readiness poll is not subject to DNS resolution differences in CI
    // (ubuntu-latest can resolve 'localhost' to ::1 before 127.0.0.1).
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
});
