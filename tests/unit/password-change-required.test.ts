// Someone whose password was set by an admin or an import (mustChangePassword)
// can't use the app until they choose their own: the dashboard sends them to
// /change-password, the API refuses, and the mobile app can't sign in.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  headers: new Headers(),
  getSession: vi.fn(),
  jwtVerify: vi.fn(),
  userFindUnique: vi.fn(),
  hospitalFindUnique: vi.fn(),
  settingFindMany: vi.fn(),
  verificationFindFirst: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`)
  }),
  compare: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: async () => h.headers }))
vi.mock('next/navigation', () => ({ redirect: h.redirect }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: h.getSession } },
  getServerSession: () => h.getSession(),
}))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    user: { findUnique: h.userFindUnique },
    hospital: { findUnique: h.hospitalFindUnique },
    setting: { findMany: h.settingFindMany },
    baVerification: { findFirst: h.verificationFindFirst },
  }
  return { prisma, default: prisma }
})
vi.mock('jose', () => ({
  jwtVerify: h.jwtVerify,
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setIssuedAt() {
      return this
    }
    setExpirationTime() {
      return this
    }
    async sign() {
      return 'signed.jwt'
    }
  },
}))
vi.mock('bcryptjs', () => ({ default: { compare: h.compare } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: () => '1.2.3.4',
}))
vi.mock('@/components/layout/dashboard-shell', () => ({ DashboardShell: () => null }))
vi.mock('@/components/i18n/clinic-locale-provider', () => ({ ClinicLocaleProvider: () => null }))

const { getAuthenticatedHospital } = await import('@/lib/api-helpers')
const { POST: mobileToken } = await import('@/app/api/auth/mobile-token/route')
const { GET: passwordPolicy } = await import('@/app/api/password-policy/route')
const { default: DashboardLayout } = await import('@/app/(dashboard)/layout')

const webSession = {
  user: { id: 'u1', email: 'a@clinic.test', name: 'A', role: 'DOCTOR', hospitalId: 'h1' },
}

beforeEach(() => {
  vi.clearAllMocks()
  h.headers = new Headers()
  h.getSession.mockResolvedValue(null)
  h.settingFindMany.mockResolvedValue([])
})

describe('the API', () => {
  it('refuses a web session until the password is changed', async () => {
    h.getSession.mockResolvedValue(webSession)
    h.userFindUnique.mockResolvedValue({ mustChangePassword: true })

    const res = await getAuthenticatedHospital()

    expect(res.user).toBeNull()
    expect(res.error?.status).toBe(403)
    expect(await res.error?.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' })
  })

  it('lets a web session through once it has been changed', async () => {
    h.getSession.mockResolvedValue(webSession)
    h.userFindUnique.mockResolvedValue({ mustChangePassword: false })
    const res = await getAuthenticatedHospital()
    expect(res.error).toBeNull()
    expect(res.hospitalId).toBe('h1')
  })

  it('refuses a mobile token too', async () => {
    h.headers = new Headers({ authorization: 'Bearer a.b.c' })
    h.jwtVerify.mockResolvedValue({ payload: { sub: 'u1', hospitalId: 'h1' } })
    h.userFindUnique.mockResolvedValue({
      isActive: true,
      mustChangePassword: true,
      hospital: { isActive: true },
    })
    const res = await getAuthenticatedHospital()
    expect(res.error?.status).toBe(403)
  })
})

describe('POST /api/auth/mobile-token', () => {
  it('won’t issue a token until the password is changed on the web', async () => {
    h.userFindUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@clinic.test',
      password: '$2b$10$hash',
      isActive: true,
      mustChangePassword: true,
      hospital: { isActive: true, name: 'Clinic' },
      staff: null,
    })
    h.compare.mockResolvedValue(true)

    const res = await mobileToken(
      new NextRequest('http://localhost/api/auth/mobile-token', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@clinic.test', password: 'Temp-pass-1' }),
      })
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' })
  })
})

describe('the dashboard', () => {
  it('sends someone who must change their password to /change-password', async () => {
    h.getSession.mockResolvedValue(webSession)
    h.userFindUnique.mockResolvedValue({ mustChangePassword: true })
    await expect(DashboardLayout({ children: null })).rejects.toThrow('REDIRECT /change-password')
    expect(h.hospitalFindUnique).not.toHaveBeenCalled()
  })
})

describe('GET /api/password-policy', () => {
  const get = (query = '') =>
    passwordPolicy(new NextRequest(`http://localhost/api/password-policy${query}`))

  it('gives a reset link’s clinic rules without signing in', async () => {
    h.verificationFindFirst.mockResolvedValue({ value: 'u1' })
    h.userFindUnique.mockResolvedValue({ hospitalId: 'h1', mustChangePassword: false })
    h.settingFindMany.mockResolvedValue([{ key: 'passwordMinLength', value: '12' }])

    const res = await get('?resetToken=tok')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.passwordPolicy.minLength).toBe(12)
    expect(body).not.toHaveProperty('mustChangePassword')
  })

  it('says when a reset link has expired or was used', async () => {
    h.verificationFindFirst.mockResolvedValue(null)
    const res = await get('?resetToken=old')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('gives a signed-in user their clinic’s rules, even while a change is required', async () => {
    h.getSession.mockResolvedValue(webSession)
    h.userFindUnique.mockResolvedValue({ hospitalId: 'h1', mustChangePassword: true })
    const body = await (await get()).json()
    expect(body.mustChangePassword).toBe(true)
    expect(body.passwordPolicy.requireUppercase).toBe(true)
  })

  it('needs a session or a reset token', async () => {
    expect((await get()).status).toBe(401)
  })
})
