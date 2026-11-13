// Which language an API response is in (getLocaleForApiRequest), and a real
// route answering a German-speaking user in German.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  headers: new Headers(),
  session: vi.fn(),
  patient: vi.fn(),
  userFindUnique: vi.fn(),
  patientFindUnique: vi.fn(),
  jwtVerify: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: async () => h.headers }))
vi.mock('jose', () => ({ jwtVerify: h.jwtVerify }))
vi.mock('@/lib/auth', () => ({
  getServerSession: h.session,
  auth: { api: { getSession: h.session } },
}))
vi.mock('@/lib/patient-auth', () => ({ getAuthenticatedPatient: h.patient }))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    user: { findUnique: h.userFindUnique },
    patient: { findUnique: h.patientFindUnique },
  }
  return { prisma, default: prisma }
})

import { getLocaleForApiRequest } from '@/lib/i18n/request'

beforeEach(() => {
  vi.clearAllMocks()
  h.headers = new Headers()
  h.session.mockResolvedValue(null)
  h.patient.mockResolvedValue(null)
})

describe('getLocaleForApiRequest', () => {
  it('follows a staff member’s own setting, else their clinic’s', async () => {
    h.session.mockResolvedValue({ user: { id: 'u1' } })
    h.userFindUnique.mockResolvedValue({ locale: 'de-DE', hospital: { locale: 'en-IN' } })
    expect(await getLocaleForApiRequest()).toBe('de-DE')

    h.userFindUnique.mockResolvedValue({ locale: null, hospital: { locale: 'de-DE' } })
    expect(await getLocaleForApiRequest()).toBe('de-DE')
  })

  it('reads the mobile app’s Bearer token', async () => {
    h.headers = new Headers({ authorization: 'Bearer a.b.c' })
    h.jwtVerify.mockResolvedValue({ payload: { sub: 'u7' } })
    h.userFindUnique.mockResolvedValue({ locale: 'de-DE', hospital: { locale: null } })
    expect(await getLocaleForApiRequest()).toBe('de-DE')
    expect(h.userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u7' } }))
  })

  it('follows a patient’s setting in the portal', async () => {
    h.patient.mockResolvedValue({ id: 'p1' })
    h.patientFindUnique.mockResolvedValue({ locale: 'de-DE', hospital: { locale: null } })
    expect(await getLocaleForApiRequest()).toBe('de-DE')
  })

  it('uses the default for anyone else, or a bad token', async () => {
    expect(await getLocaleForApiRequest()).toBe('en-IN')
    h.headers = new Headers({ authorization: 'Bearer forged' })
    h.jwtVerify.mockRejectedValue(new Error('bad signature'))
    expect(await getLocaleForApiRequest()).toBe('en-IN')
  })
})

describe('a route’s errors', () => {
  it('reach a German-speaking user in German', async () => {
    vi.resetModules()
    vi.doMock('@/lib/i18n/request', () => ({
      getLocaleForApiRequest: vi.fn().mockResolvedValue('de-DE'),
    }))
    vi.doMock('@/lib/api-helpers', () => ({
      requireAuthAndRole: vi.fn().mockResolvedValue({
        error: null,
        hospitalId: 'h1',
        user: { id: 'u1', role: 'ADMIN' },
        session: { user: { id: 'u1', role: 'ADMIN', hospitalId: 'h1' } },
      }),
      getAuthenticatedHospital: vi.fn(),
    }))
    vi.doMock('@/lib/prisma', () => {
      const prisma = {
        patient: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      }
      return { prisma, default: prisma }
    })
    const { GET } = await import('@/app/api/patients/[id]/route')
    const { NextRequest } = await import('next/server')

    const res = await GET(new NextRequest('http://localhost/api/patients/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Patient nicht gefunden' })
  })
})
