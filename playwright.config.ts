import { defineConfig, devices } from '@playwright/test';

// PLAYWRIGHT_PORT lets the suite run against a fresh dev server (for example
// while another `npm run dev` is already using 5173).
const port = process.env.PLAYWRIGHT_PORT ?? '5173';
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Tests must never reach the live pricing/checkout service or Razorpay (no real orders).
    // Tests that need them simulate them with page.route, which runs before any network access.
    launchOptions: {
      args: ['--host-resolver-rules=MAP script.google.com 127.0.0.1, MAP script.googleusercontent.com 127.0.0.1, MAP checkout.razorpay.com 127.0.0.1, MAP api.razorpay.com 127.0.0.1'],
    },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
