import { defineConfig, devices } from "@playwright/test";

/**
 * Browser suite for Cowork (E2E-01, ADR-024). It never starts a server: serve the app first
 * (`npm run build && npm run start`) and point `E2E_BASE_URL` at it if it isn't on :3000.
 * `E2E_QA_HOOKS=1` (against a build made with NEXT_PUBLIC_QA_HOOKS=1) enables the error-region spec.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // One browser at a time: `npm run start` is python's http.server, which resets connections when
  // two browsers load chunks at once (ERR_CONNECTION_RESET, the app never hydrates). Raise it with
  // E2E_WORKERS only against a server that copes.
  workers: Number(process.env.E2E_WORKERS ?? 1),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["./tests/e2e/support/compact-reporter.ts"],
    ["json", { outputFile: "e2e-results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
