// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { authConfig } from '@/lib/auth.config'

describe('authConfig', () => {
  it('configures signIn page as /login', () => {
    expect(authConfig.pages?.signIn).toBe('/login')
  })

  it('configures error page as /login', () => {
    expect(authConfig.pages?.error).toBe('/login')
  })

  it('exposes jwt and session callbacks', () => {
    expect(typeof authConfig.callbacks?.jwt).toBe('function')
    expect(typeof authConfig.callbacks?.session).toBe('function')
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
