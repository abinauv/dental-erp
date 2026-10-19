import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect method with Testing Library matchers
expect.extend(matchers)

// Cleanup after each test case
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}))

// next-intl without a provider: resolve translations against the real en-IN
// catalogue so components render their actual English text (keeping text-based
// assertions valid), and make the client provider a passthrough.
vi.mock('next-intl', async () => {
  const messages = (await import('../messages/en-IN.json')).default as Record<string, unknown>
  const resolve = (namespace: string | undefined, key: string): unknown => {
    const path = namespace ? `${namespace}.${key}` : key
    return path
      .split('.')
      .reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as any)[k] : undefined), messages)
  }
  const makeT = (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      const msg = resolve(namespace, key)
      if (typeof msg !== 'string') return namespace ? `${namespace}.${key}` : key
      return values
        ? msg.replace(/\{(\w+)\}/g, (_, k) => (k in values ? String(values[k]) : `{${k}}`))
        : msg
    }
    ;(t as any).rich = (key: string) => resolve(namespace, key)
    ;(t as any).raw = (key: string) => resolve(namespace, key)
    ;(t as any).has = (key: string) => resolve(namespace, key) !== undefined
    return t
  }
  // Real next-intl returns a stable `t` per namespace across renders, so
  // components can safely list it in effect/callback dependency arrays. Cache
  // here too — a fresh function each render would make such effects re-run every
  // render and spin into an infinite update loop.
  const tCache = new Map<string, ReturnType<typeof makeT>>()
  const getT = (namespace?: string) => {
    const cacheKey = namespace ?? ''
    let cached = tCache.get(cacheKey)
    if (!cached) {
      cached = makeT(namespace)
      tCache.set(cacheKey, cached)
    }
    return cached
  }
  return {
    useTranslations: (namespace?: string) => getT(namespace),
    useLocale: () => 'en-IN',
    useMessages: () => messages,
    useFormatter: () => ({
      number: (v: number) => String(v),
      dateTime: (d: Date) => String(d),
      relativeTime: (d: Date) => String(d),
    }),
    useNow: () => new Date(),
    useTimeZone: () => 'Asia/Kolkata',
    NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  }
})

// Mock environment variables
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/dental_erp_test'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key'
process.env.CRON_SECRET = 'test-cron-secret'
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
process.env.TZ = 'Asia/Kolkata'

// Global fetch mock
global.fetch = vi.fn()

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver. Use a regular function, not an arrow: these are
// invoked with `new` (e.g. Next's use-intersection), and under vitest 5 the mock
// implementation is run as a constructor — an arrow can't be constructed.
global.IntersectionObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }
})

// Mock ResizeObserver (also constructed with `new`).
global.ResizeObserver = vi.fn().mockImplementation(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }
})
