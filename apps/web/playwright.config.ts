import { defineConfig, devices } from "@playwright/test"

// Runs a production build of the web app against a real API on the test
// database. Ports and distDir differ from `bun dev` so both can run at once.
const WEB_PORT = 3100
const API_PORT = 3101
const webUrl = `http://localhost:${WEB_PORT}`
const apiUrl = `http://localhost:${API_PORT}`

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: webUrl,
    locale: "th-TH",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // test/env.ts points the API at hestia_test.
      command: "bun --preload ./test/env.ts src/index.ts",
      cwd: "../api",
      url: `${apiUrl}/health`,
      env: { API_PORT: String(API_PORT), E2E_WEB_ORIGIN: webUrl },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `bunx next build && bunx next start --port ${WEB_PORT}`,
      url: `${webUrl}/login`,
      env: { API_URL: apiUrl, NEXT_DIST_DIR: ".next-e2e" },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
})
