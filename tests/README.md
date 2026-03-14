# DentalERP — Test Suite

## Overview

The DentalERP test suite uses **Vitest** (unit/integration) and **Playwright** (E2E) to provide comprehensive test coverage across the entire application.

| Metric | Count |
|--------|-------|
| Vitest test files | 175+ |
| Vitest tests | 4,000+ |
| Playwright E2E spec files | 51 |
| Playwright E2E tests | ~478 |
| Browser projects | 6 (Chrome, Firefox, Safari, Edge, Mobile Chrome, Mobile Safari) |

## Directory Structure

```
tests/
├── __mocks__/          # Shared mocks (Prisma, auth, etc.)
├── accessibility/      # WCAG 2.1 AA, screen reader, keyboard nav tests
├── api/                # API route integration tests
├── api-validation/     # Request/response format, status codes, edge cases
├── compatibility/      # Network resilience, browser compat, device/resolution
├── components/         # React component tests (RTL + axe-core)
├── comprehensive/      # Full CRUD lifecycle tests per entity
├── database/           # DB CRUD, consistency, concurrency, migration tests
├── deployment/         # Build config, env vars, CI/CD validation tests
├── e2e/                # Playwright E2E user workflow tests
├── hooks/              # Custom React hook tests
├── integration/        # Cross-module integration tests
├── performance/        # Page load, API response, bundle size tests
├── regression/         # Regression tests for cross-cutting concerns
├── security/           # Auth, authorization, encryption, injection tests
├── smoke/              # Quick smoke tests for all pages
├── unit/               # Pure unit tests for lib/ utilities
├── setup.ts            # Vitest global setup (DOM polyfills, fetch mock)
└── README.md           # This file
```

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all Vitest tests once
npm test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run with interactive UI
npm run test:ui

# Run a specific test file
npx vitest run tests/unit/utils.test.ts

# Run tests matching a pattern
npx vitest run -t "billing"
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests (requires dev server)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run a specific spec file
npx playwright test tests/e2e/auth.spec.ts

# Run on a specific browser
npx playwright test --project=chromium

# Run all tests (Vitest + Playwright)
npm run test:all
```

### Coverage

Coverage is configured for `lib/`, `app/api/`, and `components/` directories:

```bash
npm run test:coverage
```

Reports are generated in `coverage/` in text, JSON, and HTML formats.

## Test Architecture

### Mocking Strategy

- **Prisma**: Mocked globally via `tests/__mocks__/prisma.ts` — all DB operations use `vi.fn()` stubs
- **NextAuth**: `auth()` mocked to return configurable session objects per test
- **next/navigation**: `useRouter`, `usePathname`, `useSearchParams` mocked consistently
- **External services**: Payment gateways, SMS, email all mocked at the module boundary
- **Fetch**: Global fetch is polyfilled in `tests/setup.ts`

### Test Patterns

1. **API tests**: Mock Prisma + auth → call the route handler directly → assert response
2. **Component tests**: Render with RTL → interact → assert DOM state
3. **E2E tests**: Playwright navigates real pages → asserts visible content
4. **Security tests**: Verify crypto, auth flows, injection prevention, header config
5. **Performance tests**: Verify query efficiency patterns, pagination, caching config

### Fixtures & Helpers

- Auth fixtures: `tests/e2e/fixtures/auth.ts` (Playwright auth state)
- Mock data is co-located in each test file for clarity
- `setViewport()` helper in responsive/compatibility tests simulates breakpoints

## CI/CD Integration

Tests run automatically via GitHub Actions (`.github/workflows/ci.yml`):

| Job | Trigger | What runs |
|-----|---------|-----------|
| `lint-and-type-check` | PR | `next lint` + `tsc --noEmit` |
| `unit-tests` | PR | `vitest run` with coverage upload |
| `e2e-tests` | merge to main | Playwright with MySQL service container |
| `build` | PR | `next build` verification |

### Git Hooks (Husky)

- **pre-commit**: Runs `lint-staged` (lint + type check on staged files)
- **pre-push**: Runs `npm test` (full Vitest suite)

## Adding New Tests

1. **Choose the right directory** based on what you're testing (see structure above)
2. **Follow existing patterns** — read a similar test file first
3. **Mock at boundaries** — mock Prisma/auth, not internal functions
4. **Use `@ts-nocheck`** at the top of test files to avoid strict type errors from mocks
5. **Name descriptively** — `tests/api/patients.test.ts`, `tests/e2e/billing-invoice.spec.ts`
6. **Keep tests independent** — each test should set up its own data and not depend on order

## Configuration Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest config: jsdom, aliases, coverage, timeouts |
| `playwright.config.ts` | Playwright: 6 browsers, retries, screenshots, web server |
| `tests/setup.ts` | Global setup: DOM polyfills, fetch, cleanup |
