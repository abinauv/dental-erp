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

// The middleware does: export default auth((req) => { ... })
// Our auth mock just returns the handler as-is, so `middleware` IS the handler
vi.mock('@/lib/auth', () => ({
  auth: (handler: Function) => handler,
}))

import middleware, { config } from '@/middleware'

function makeRequest(pathname: string, session?: any) {
  const url = new URL(`http://localhost:3000${pathname}`)
  return {
    nextUrl: url,
    auth: session,
  }
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation((url) => ({ type: 'redirect', url }))
    mockNext.mockReturnValue({ type: 'next' })
  })

  // Public routes
  it('allows access to /login without auth', () => {
    middleware(makeRequest('/login', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /signup without auth', () => {
    middleware(makeRequest('/signup', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /forgot-password without auth', () => {
    middleware(makeRequest('/forgot-password', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /pricing without auth', () => {
    middleware(makeRequest('/pricing', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /verify-email without auth', () => {
    middleware(makeRequest('/verify-email', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /invite/accept without auth', () => {
    middleware(makeRequest('/invite/accept', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to landing page / without auth', () => {
    middleware(makeRequest('/', null))
    expect(mockNext).toHaveBeenCalled()
  })

  // API routes pass through
  it('allows all API routes through', () => {
    middleware(makeRequest('/api/patients', null))
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /api/auth routes through', () => {
    middleware(makeRequest('/api/auth/signin', null))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /api/public routes through', () => {
    middleware(makeRequest('/api/public/signup', null))
    expect(mockNext).toHaveBeenCalled()
  })

  // Logged-in user redirect from public pages
  it('redirects logged-in user from /login to /dashboard', () => {
    middleware(makeRequest('/login', { user: { role: 'ADMIN' } }))
    expect(mockRedirect).toHaveBeenCalled()
    const url = mockRedirect.mock.calls[0][0]
    expect(url.pathname).toBe('/dashboard')
  })

  it('redirects logged-in user from /signup to /dashboard', () => {
    middleware(makeRequest('/signup', { user: { role: 'ADMIN' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('redirects logged-in user from / to /dashboard', () => {
    middleware(makeRequest('/', { user: { role: 'ADMIN' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  // Unauthenticated redirect to login
  it('redirects unauthenticated user from /dashboard to /login', () => {
    middleware(makeRequest('/dashboard', null))
    expect(mockRedirect).toHaveBeenCalled()
    const url = mockRedirect.mock.calls[0][0]
    expect(url.pathname).toBe('/login')
  })

  it('includes callbackUrl when redirecting to login', () => {
    middleware(makeRequest('/patients', null))
    expect(mockRedirect).toHaveBeenCalled()
    const url = mockRedirect.mock.calls[0][0]
    expect(url.searchParams.get('callbackUrl')).toBe('/patients')
  })

  // Role-based access
  it('allows ADMIN to access /settings', () => {
    middleware(makeRequest('/settings', { user: { role: 'ADMIN' } }))
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects DOCTOR from /settings to /dashboard', () => {
    middleware(makeRequest('/settings', { user: { role: 'DOCTOR' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows DOCTOR to access /treatments', () => {
    middleware(makeRequest('/treatments', { user: { role: 'DOCTOR' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /treatments to /dashboard', () => {
    middleware(makeRequest('/treatments', { user: { role: 'RECEPTIONIST' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows RECEPTIONIST to access /billing', () => {
    middleware(makeRequest('/billing', { user: { role: 'RECEPTIONIST' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows ACCOUNTANT to access /billing', () => {
    middleware(makeRequest('/billing', { user: { role: 'ACCOUNTANT' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows LAB_TECH to access /lab', () => {
    middleware(makeRequest('/lab', { user: { role: 'LAB_TECH' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /lab to /dashboard', () => {
    middleware(makeRequest('/lab', { user: { role: 'RECEPTIONIST' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows ADMIN to access /staff', () => {
    middleware(makeRequest('/staff', { user: { role: 'ADMIN' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects DOCTOR from /staff to /dashboard', () => {
    middleware(makeRequest('/staff', { user: { role: 'DOCTOR' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows ADMIN to access /inventory', () => {
    middleware(makeRequest('/inventory', { user: { role: 'ADMIN' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects DOCTOR from /inventory to /dashboard', () => {
    middleware(makeRequest('/inventory', { user: { role: 'DOCTOR' } }))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows ADMIN to access /communications', () => {
    middleware(makeRequest('/communications', { user: { role: 'ADMIN' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows RECEPTIONIST to access /communications', () => {
    middleware(makeRequest('/communications', { user: { role: 'RECEPTIONIST' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  // Onboarding
  it('allows authenticated user to access /onboarding', () => {
    middleware(makeRequest('/onboarding', { user: { role: 'ADMIN' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  // Dashboard access for all authenticated roles
  it('allows any authenticated user to access /dashboard', () => {
    const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT', 'LAB_TECH']
    roles.forEach((role) => {
      vi.clearAllMocks()
      mockNext.mockReturnValue({ type: 'next' })
      middleware(makeRequest('/dashboard', { user: { role } }))
      expect(mockNext).toHaveBeenCalled()
    })
  })

  // Reports access
  it('allows DOCTOR to access /reports', () => {
    middleware(makeRequest('/reports', { user: { role: 'DOCTOR' } }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /reports to /dashboard', () => {
    middleware(makeRequest('/reports', { user: { role: 'RECEPTIONIST' } }))
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
