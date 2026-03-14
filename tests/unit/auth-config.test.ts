// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { authConfig } from '@/lib/auth.config'

describe('authConfig', () => {
  it('has trustHost set to true', () => {
    expect(authConfig.trustHost).toBe(true)
  })

  it('configures signIn page as /login', () => {
    expect(authConfig.pages?.signIn).toBe('/login')
  })

  it('configures error page as /login', () => {
    expect(authConfig.pages?.error).toBe('/login')
  })

  it('has empty providers array', () => {
    expect(authConfig.providers).toEqual([])
  })
})

describe('authConfig.callbacks.jwt', () => {
  const jwtCallback = authConfig.callbacks!.jwt!

  it('copies user fields to token on first login', () => {
    const token: any = {}
    const user: any = {
      id: 'u-1',
      role: 'ADMIN',
      staffId: 's-1',
      hospitalId: 'h-1',
      isHospitalAdmin: true,
    }
    const result = jwtCallback({ token, user } as any)
    expect(result).toMatchObject({
      id: 'u-1',
      role: 'ADMIN',
      staffId: 's-1',
      hospitalId: 'h-1',
      isHospitalAdmin: true,
    })
  })

  it('returns token unchanged when no user (subsequent requests)', () => {
    const token: any = { id: 'existing', role: 'DOCTOR' }
    const result = jwtCallback({ token, user: undefined } as any)
    expect(result.id).toBe('existing')
    expect(result.role).toBe('DOCTOR')
  })

  it('handles user without staffId', () => {
    const token: any = {}
    const user: any = {
      id: 'u-2',
      role: 'ADMIN',
      staffId: undefined,
      hospitalId: 'h-1',
      isHospitalAdmin: true,
    }
    const result = jwtCallback({ token, user } as any)
    expect(result.staffId).toBeUndefined()
  })
})

describe('authConfig.callbacks.session', () => {
  const sessionCallback = authConfig.callbacks!.session!

  it('copies token fields to session.user', () => {
    const session: any = { user: {} }
    const token: any = {
      id: 'u-1',
      role: 'ADMIN',
      staffId: 's-1',
      hospitalId: 'h-1',
      isHospitalAdmin: true,
    }
    const result = sessionCallback({ session, token } as any)
    expect(result.user).toMatchObject({
      id: 'u-1',
      role: 'ADMIN',
      staffId: 's-1',
      hospitalId: 'h-1',
      isHospitalAdmin: true,
    })
  })

  it('returns session unchanged when token is null', () => {
    const session: any = { user: { name: 'Test' } }
    const result = sessionCallback({ session, token: null } as any)
    expect(result.user.name).toBe('Test')
  })
})

describe('authConfig.callbacks.authorized', () => {
  const authorizedCallback = authConfig.callbacks!.authorized!

  function makeReq(pathname: string) {
    return { nextUrl: new URL(`http://localhost:3000${pathname}`) }
  }

  it('allows access to /login without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/login') } as any)
    expect(result).toBe(true)
  })

  it('allows access to /signup without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/signup') } as any)
    expect(result).toBe(true)
  })

  it('allows access to /forgot-password without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/forgot-password') } as any)
    expect(result).toBe(true)
  })

  it('allows access to /pricing without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/pricing') } as any)
    expect(result).toBe(true)
  })

  it('allows access to landing page / without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/') } as any)
    expect(result).toBe(true)
  })

  it('allows access to /verify-email without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/verify-email') } as any)
    expect(result).toBe(true)
  })

  it('allows access to /invite/accept without auth', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/invite/accept/token123') } as any)
    expect(result).toBe(true)
  })

  it('redirects logged-in user from /login to /dashboard', () => {
    const result = authorizedCallback({
      auth: { user: { role: 'ADMIN' } },
      request: makeReq('/login'),
    } as any)
    expect(result).toBeInstanceOf(Response)
    const location = (result as Response).headers.get('location')
    expect(location).toContain('/dashboard')
  })

  it('redirects logged-in user from /signup to /dashboard', () => {
    const result = authorizedCallback({
      auth: { user: { role: 'ADMIN' } },
      request: makeReq('/signup'),
    } as any)
    expect(result).toBeInstanceOf(Response)
  })

  it('redirects logged-in user from / to /dashboard', () => {
    const result = authorizedCallback({
      auth: { user: { role: 'ADMIN' } },
      request: makeReq('/'),
    } as any)
    expect(result).toBeInstanceOf(Response)
  })

  it('allows logged-in user on /forgot-password (no redirect)', () => {
    const result = authorizedCallback({
      auth: { user: { role: 'ADMIN' } },
      request: makeReq('/forgot-password'),
    } as any)
    expect(result).toBe(true)
  })

  it('denies unauthenticated user from /dashboard', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/dashboard') } as any)
    expect(result).toBe(false)
  })

  it('denies unauthenticated user from /patients', () => {
    const result = authorizedCallback({ auth: null, request: makeReq('/patients') } as any)
    expect(result).toBe(false)
  })

  it('allows authenticated user to access /dashboard', () => {
    const result = authorizedCallback({
      auth: { user: { role: 'DOCTOR' } },
      request: makeReq('/dashboard'),
    } as any)
    expect(result).toBe(true)
  })

  it('allows authenticated user to access /settings', () => {
    const result = authorizedCallback({
      auth: { user: { role: 'ADMIN' } },
      request: makeReq('/settings'),
    } as any)
    expect(result).toBe(true)
  })
})
