import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

/**
 * Browsers exercised locally. CI runs chromium only: the suite is ~480 tests,
 * and running all six projects serially on a single runner took over six hours
 * and got killed by the GitHub Actions job limit. Run the full matrix locally
 * (or via the `e2e-full` workflow_dispatch) with `npx playwright test`.
 */
const allProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'edge', use: { ...devices['Desktop Edge'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
]

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // GitHub-hosted runners have 4 cores. One worker per test file is plenty and
  // keeps concurrent writes against the single test database manageable.
  workers: isCI ? 2 : undefined,
  // Cap the whole run so a systemic failure surfaces as a red build in minutes
  // instead of burning the job's six-hour ceiling. 45min, because retrying the
  // suite's ~184 currently-failing specs is what makes a full run slow; a
  // repaired suite finishes in well under half of this.
  globalTimeout: isCI ? 45 * 60 * 1000 : undefined,
  timeout: 45 * 1000,
  expect: { timeout: 10 * 1000 },
  // 'line' keeps CI logs readable; the HTML report is uploaded as an artifact.
  // `open: 'never'` stops the reporter from starting a blocking preview server.
  reporter: isCI ? [['line'], ['html', { open: 'never' }]] : [['html', { open: 'on-failure' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: isCI ? allProjects.filter((p) => p.name === 'chromium') : allProjects,
  webServer: {
    // A dev server recompiles every route on first request, which blew the
    // per-test timeout repeatedly in CI. CI builds first and serves the
    // production output instead.
    command: isCI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
})
