// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock NextResponse
const mockRedirect = vi.fn()
const mockNext = vi.fn().mockReturnValue({ type: 'next' })

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: any[]) => mockRedirect(...args),
    next: () => mockNext(),
  },
}))

// Better Auth's optimistic cookie check: logged in iff a session cookie is present.
vi.mock('better-auth/cookies', () => ({
  getSessionCookie: (req: any) =>
    req.headers.get('cookie')?.includes('session') ? 'session-token' : null,
}))

import middleware, { config } from '@/middleware'

// Build a request. `loggedIn` controls the session cookie; `role` is what the
// mocked /api/auth/get-session returns for role-gated prefixes.
function makeRequest(pathname: string, { loggedIn = false, role = 'ADMIN' } = {}) {
  const url = new URL(`http://localhost:3000${pathname}`)
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => (loggedIn ? { user: { role } } : null),
  }) as any
  return {
    nextUrl: url,
    url: url.toString(),
    headers: {
      get: (h: string) => (h === 'cookie' ? (loggedIn ? 'better-auth.session=abc' : '') : null),
    },
  }
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation((url) => ({ type: 'redirect', url }))
    mockNext.mockReturnValue({ type: 'next' })
  })

  // Public routes
  for (const route of [
    '/login',
    '/signup',
    '/forgot-password',
    '/pricing',
    '/verify-email',
    '/invite/accept',
    '/',
  ]) {
    it(`allows access to ${route} without auth`, async () => {
      await middleware(makeRequest(route, { loggedIn: false }))
      expect(mockNext).toHaveBeenCalled()
    })
  }

  // API routes pass through
  it('allows all API routes through', async () => {
    await middleware(makeRequest('/api/patients', { loggedIn: false }))
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /api/auth routes through', async () => {
    await middleware(makeRequest('/api/auth/signin', { loggedIn: false }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /api/public routes through', async () => {
    await middleware(makeRequest('/api/public/signup', { loggedIn: false }))
    expect(mockNext).toHaveBeenCalled()
  })

  // Logged-in user redirect from public pages
  it('redirects logged-in user from /login to /dashboard', async () => {
    await middleware(makeRequest('/login', { loggedIn: true }))
    expect(mockRedirect).toHaveBeenCalled()
    expect(mockRedirect.mock.calls[0][0].pathname).toBe('/dashboard')
  })

  it('redirects logged-in user from /signup to /dashboard', async () => {
    await middleware(makeRequest('/signup', { loggedIn: true }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('redirects logged-in user from / to /dashboard', async () => {
    await middleware(makeRequest('/', { loggedIn: true }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  // Unauthenticated redirect to login
  it('redirects unauthenticated user from /dashboard to /login', async () => {
    await middleware(makeRequest('/dashboard', { loggedIn: false }))
    expect(mockRedirect).toHaveBeenCalled()
    expect(mockRedirect.mock.calls[0][0].pathname).toBe('/login')
  })

  it('includes callbackUrl when redirecting to login', async () => {
    await middleware(makeRequest('/patients', { loggedIn: false }))
    expect(mockRedirect).toHaveBeenCalled()
    expect(mockRedirect.mock.calls[0][0].searchParams.get('callbackUrl')).toBe('/patients')
  })

  // Role-based access (role comes from the mocked get-session fetch)
  it('allows ADMIN to access /settings', async () => {
    await middleware(makeRequest('/settings', { loggedIn: true, role: 'ADMIN' }))
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects DOCTOR from /settings to /dashboard', async () => {
    await middleware(makeRequest('/settings', { loggedIn: true, role: 'DOCTOR' }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows DOCTOR to access /treatments', async () => {
    await middleware(makeRequest('/treatments', { loggedIn: true, role: 'DOCTOR' }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /treatments to /dashboard', async () => {
    await middleware(makeRequest('/treatments', { loggedIn: true, role: 'RECEPTIONIST' }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows RECEPTIONIST to access /billing', async () => {
    await middleware(makeRequest('/billing', { loggedIn: true, role: 'RECEPTIONIST' }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows LAB_TECH to access /lab', async () => {
    await middleware(makeRequest('/lab', { loggedIn: true, role: 'LAB_TECH' }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /lab to /dashboard', async () => {
    await middleware(makeRequest('/lab', { loggedIn: true, role: 'RECEPTIONIST' }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('redirects DOCTOR from /staff to /dashboard', async () => {
    await middleware(makeRequest('/staff', { loggedIn: true, role: 'DOCTOR' }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('redirects DOCTOR from /inventory to /dashboard', async () => {
    await middleware(makeRequest('/inventory', { loggedIn: true, role: 'DOCTOR' }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  // Onboarding and dashboard are allowed for any authenticated role.
  it('allows authenticated user to access /onboarding', async () => {
    await middleware(makeRequest('/onboarding', { loggedIn: true, role: 'ADMIN' }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows any authenticated user to access /dashboard', async () => {
    for (const role of ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT', 'LAB_TECH']) {
      vi.clearAllMocks()
      mockNext.mockReturnValue({ type: 'next' })
      await middleware(makeRequest('/dashboard', { loggedIn: true, role }))
      expect(mockNext).toHaveBeenCalled()
    }
  })

  it('redirects RECEPTIONIST from /reports to /dashboard', async () => {
    await middleware(makeRequest('/reports', { loggedIn: true, role: 'RECEPTIONIST' }))
    expect(mockRedirect).toHaveBeenCalled()
  })
})

describe('middleware config', () => {
  it('exports matcher config', () => {
    expect(config).toBeDefined()
    expect(config.matcher).toBeDefined()
    expect(Array.isArray(config.matcher)).toBe(true)
  })
})
