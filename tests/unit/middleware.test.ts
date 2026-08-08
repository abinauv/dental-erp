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

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

import proxy, { config } from '@/proxy'
import { getToken } from 'next-auth/jwt'

const mockGetToken = vi.mocked(getToken)

function makeRequest(pathname: string) {
  const url = new URL(`http://localhost:3000${pathname}`)
  return {
    nextUrl: url,
  } as any
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation((url) => ({ type: 'redirect', url }))
    mockNext.mockReturnValue({ type: 'next' })
    mockGetToken.mockResolvedValue(null as any)
  })

  // Public routes
  it('allows access to /login without auth', async () => {
    await proxy(makeRequest('/login'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /signup without auth', async () => {
    await proxy(makeRequest('/signup'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /forgot-password without auth', async () => {
    await proxy(makeRequest('/forgot-password'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /pricing without auth', async () => {
    await proxy(makeRequest('/pricing'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /verify-email without auth', async () => {
    await proxy(makeRequest('/verify-email'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to /invite/accept without auth', async () => {
    await proxy(makeRequest('/invite/accept'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows access to landing page / without auth', async () => {
    await proxy(makeRequest('/'))
    expect(mockNext).toHaveBeenCalled()
  })

  // API routes pass through
  it('allows all API routes through', async () => {
    await proxy(makeRequest('/api/patients'))
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /api/auth routes through', async () => {
    await proxy(makeRequest('/api/auth/signin'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /api/public routes through', async () => {
    await proxy(makeRequest('/api/public/signup'))
    expect(mockNext).toHaveBeenCalled()
  })

  // Logged-in user redirect from public pages
  it('redirects logged-in user from /login to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/login'))
    expect(mockRedirect).toHaveBeenCalled()
    const url = mockRedirect.mock.calls[0][0]
    expect(url.pathname).toBe('/dashboard')
  })

  it('redirects logged-in user from /signup to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/signup'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('redirects logged-in user from / to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  // Unauthenticated redirect to login
  it('redirects unauthenticated user from /dashboard to /login', async () => {
    await proxy(makeRequest('/dashboard'))
    expect(mockRedirect).toHaveBeenCalled()
    const url = mockRedirect.mock.calls[0][0]
    expect(url.pathname).toBe('/login')
  })

  it('includes callbackUrl when redirecting to login', async () => {
    await proxy(makeRequest('/patients'))
    expect(mockRedirect).toHaveBeenCalled()
    const url = mockRedirect.mock.calls[0][0]
    expect(url.searchParams.get('callbackUrl')).toBe('/patients')
  })

  // Role-based access
  it('allows ADMIN to access /settings', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/settings'))
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects DOCTOR from /settings to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'DOCTOR' } as any)
    await proxy(makeRequest('/settings'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows DOCTOR to access /treatments', async () => {
    mockGetToken.mockResolvedValue({ role: 'DOCTOR' } as any)
    await proxy(makeRequest('/treatments'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /treatments to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'RECEPTIONIST' } as any)
    await proxy(makeRequest('/treatments'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows RECEPTIONIST to access /billing', async () => {
    mockGetToken.mockResolvedValue({ role: 'RECEPTIONIST' } as any)
    await proxy(makeRequest('/billing'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows ACCOUNTANT to access /billing', async () => {
    mockGetToken.mockResolvedValue({ role: 'ACCOUNTANT' } as any)
    await proxy(makeRequest('/billing'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows LAB_TECH to access /lab', async () => {
    mockGetToken.mockResolvedValue({ role: 'LAB_TECH' } as any)
    await proxy(makeRequest('/lab'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /lab to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'RECEPTIONIST' } as any)
    await proxy(makeRequest('/lab'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows ADMIN to access /staff', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/staff'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects DOCTOR from /staff to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'DOCTOR' } as any)
    await proxy(makeRequest('/staff'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows ADMIN to access /inventory', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/inventory'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects DOCTOR from /inventory to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'DOCTOR' } as any)
    await proxy(makeRequest('/inventory'))
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('allows ADMIN to access /communications', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/communications'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows RECEPTIONIST to access /communications', async () => {
    mockGetToken.mockResolvedValue({ role: 'RECEPTIONIST' } as any)
    await proxy(makeRequest('/communications'))
    expect(mockNext).toHaveBeenCalled()
  })

  // Onboarding
  it('allows authenticated user to access /onboarding', async () => {
    mockGetToken.mockResolvedValue({ role: 'ADMIN' } as any)
    await proxy(makeRequest('/onboarding'))
    expect(mockNext).toHaveBeenCalled()
  })

  // Dashboard access for all authenticated roles
  it('allows any authenticated user to access /dashboard', async () => {
    const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT', 'LAB_TECH']
    for (const role of roles) {
      vi.clearAllMocks()
      mockNext.mockReturnValue({ type: 'next' })
      mockGetToken.mockResolvedValue({ role } as any)
      await proxy(makeRequest('/dashboard'))
      expect(mockNext).toHaveBeenCalled()
    }
  })

  // Reports access
  it('allows DOCTOR to access /reports', async () => {
    mockGetToken.mockResolvedValue({ role: 'DOCTOR' } as any)
    await proxy(makeRequest('/reports'))
    expect(mockNext).toHaveBeenCalled()
  })

  it('redirects RECEPTIONIST from /reports to /dashboard', async () => {
    mockGetToken.mockResolvedValue({ role: 'RECEPTIONIST' } as any)
    await proxy(makeRequest('/reports'))
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
