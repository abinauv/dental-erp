import { defineConfig, devices } from '@playwright/test'

/**
 * Visual snapshots of the app's pages, for checking UI-wide changes (such as a
 * Tailwind upgrade) against a baseline. Not part of CI.
 *
 * Runs against an already running app seeded with `npm run db:seed`, at
 * VISUAL_BASE_URL (default: the Docker staging stack on :3300). Signs in as
 * VISUAL_EMAIL / VISUAL_PASSWORD (default: the seeded admin).
 *
 *   npm run visual:baseline   record screenshots of the UI as it is now
 *   npm run visual:compare    compare the UI against that baseline
 *
 * The comparison is most reliable when the baseline and the candidate are
 * captured in the same session against the same database, so that dates and
 * relative times match. Everything is written to .visual/ (gitignored); open
 * .visual/report/index.html for side-by-side diffs.
 */
// The full Chromium build in headless mode, pinned to Playwright's version, so
// screenshots don't change when an installed browser auto-updates. (The
// separate headless-shell binary can be blocked by Windows Smart App Control.)
const browser = { channel: 'chromium' }
const desktop = { ...devices['Desktop Chrome'], ...browser, viewport: { width: 1440, height: 900 } }

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.visual.ts',
  outputDir: '.visual/results',
  snapshotPathTemplate: '.visual/snapshots/{projectName}/{arg}{ext}',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: '.visual/report', open: 'never' }]],
  globalSetup: './tests/visual/global-setup.ts',
  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? 'http://localhost:3300',
    storageState: '.visual/auth.json',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
  projects: [
    { name: 'desktop', use: desktop },
    // The core pages again on a phone and in dark mode.
    { name: 'mobile', use: { ...devices['Pixel 7'], ...browser }, grep: /@core/ },
    { name: 'dark', use: { ...desktop, colorScheme: 'dark' }, grep: /@core/ },
  ],
})
