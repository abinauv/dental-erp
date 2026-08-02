// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/patient-auth', () => ({
  requirePatientAuth: vi.fn(),
  getAuthenticatedPatient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as profileGET, PATCH as profilePATCH } from '@/app/api/settings/profile/route'
import {
  GET as portalProfileGET,
  PATCH as portalProfilePATCH,
} from '@/app/api/patient-portal/profile/route'
import { getLocaleForRequest, getLocaleForPatientRequest } from '@/lib/i18n/request'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { requirePatientAuth, getAuthenticatedPatient } from '@/lib/patient-auth'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(path: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(`http://localhost${path}`, init)
}

const STAFF = { id: 'user-1', role: 'ADMIN', hospitalId: 'hosp-1' }
const PATIENT = { id: 'patient-1', hospitalId: 'hosp-1' }

function signedInAsStaff() {
  requireAuthAndRole.mockResolvedValue({
    error: null,
    user: STAFF,
    hospitalId: 'hosp-1',
    session: { user: STAFF },
  })
}

function signedInAsPatient() {
  requirePatientAuth.mockResolvedValue({ error: null, patient: PATIENT })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/settings/profile
// ═════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/settings/profile', () => {
  it('rejects an unauthenticated caller', async () => {
    requireAuthAndRole.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
      hospitalId: null,
      session: null,
    })

    const res = await profilePATCH(makeReq('/api/settings/profile', 'PATCH', { locale: 'en-US' }))
    expect(res.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('stores a supported locale', async () => {
    signedInAsStaff()
    prisma.user.update.mockResolvedValue({
      locale: 'en-US',
      hospital: { locale: 'en-IN' },
    })

    const res = await profilePATCH(makeReq('/api/settings/profile', 'PATCH', { locale: 'en-US' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.locale).toBe('en-US')
    expect(body.data.effectiveLocale).toBe('en-US')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { locale: 'en-US' },
      })
    )
  })

  // The write side of "null means inherit". Clearing has to persist NULL, not
  // the clinic's current value, or the user stops following the clinic.
  it('writes null when the override is cleared', async () => {
    signedInAsStaff()
    prisma.user.update.mockResolvedValue({ locale: null, hospital: { locale: 'en-US' } })

    const res = await profilePATCH(makeReq('/api/settings/profile', 'PATCH', { locale: null }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { locale: null } })
    )
    expect(body.data.locale).toBeNull()
    // Still resolves to something usable — the clinic's locale.
    expect(body.data.effectiveLocale).toBe('en-US')
  })

  it('treats an empty string the same as clearing', async () => {
    signedInAsStaff()
    prisma.user.update.mockResolvedValue({ locale: null, hospital: { locale: 'en-IN' } })

    const res = await profilePATCH(makeReq('/api/settings/profile', 'PATCH', { locale: '' }))

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { locale: null } })
    )
  })

  // The cascade tolerates junk in the column; the write boundary should not
  // put it there in the first place.
  it('rejects an unsupported locale with 400 rather than storing it', async () => {
    signedInAsStaff()

    const res = await profilePATCH(makeReq('/api/settings/profile', 'PATCH', { locale: 'de-DE' }))

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a malformed body with 400 rather than 500', async () => {
    signedInAsStaff()

    const req = new NextRequest('http://localhost/api/settings/profile', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await profilePATCH(req)

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  // A user id in the body must be ignored — this endpoint is not an admin tool.
  it('always writes the session user, never an id from the body', async () => {
    signedInAsStaff()
    prisma.user.update.mockResolvedValue({ locale: 'en-US', hospital: { locale: 'en-IN' } })

    await profilePATCH(
      makeReq('/api/settings/profile', 'PATCH', { locale: 'en-US', id: 'someone-else' })
    )

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    )
  })
})

describe('GET /api/settings/profile', () => {
  it('returns the raw override alongside the resolved locale', async () => {
    signedInAsStaff()
    prisma.user.findUnique.mockResolvedValue({
      name: 'Asha',
      email: 'asha@example.com',
      locale: null,
      hospital: { locale: 'en-US' },
    })

    const res = await profileGET()
    const body = await res.json()

    expect(res.status).toBe(200)
    // null, not 'en-US' — the UI has to be able to show "use clinic default"
    // as selected rather than pinning the clinic's current value.
    expect(body.data.locale).toBeNull()
    expect(body.data.hospitalLocale).toBe('en-US')
    expect(body.data.effectiveLocale).toBe('en-US')
    expect(body.data.supportedLocales).toContain('en-IN')
  })

  it('returns 404 when the session user no longer exists', async () => {
    signedInAsStaff()
    prisma.user.findUnique.mockResolvedValue(null)

    const res = await profileGET()
    expect(res.status).toBe(404)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// /api/patient-portal/profile
// ═════════════════════════════════════════════════════════════════════════════

describe('/api/patient-portal/profile', () => {
  it('rejects a caller without a portal session', async () => {
    requirePatientAuth.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      patient: null,
    })

    const res = await portalProfilePATCH(
      makeReq('/api/patient-portal/profile', 'PATCH', { locale: 'en-US' })
    )

    expect(res.status).toBe(401)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  // The portal is the one authenticated surface where the caller is not staff.
  it('writes the cookie patient, never an id from the body', async () => {
    signedInAsPatient()
    prisma.patient.update.mockResolvedValue({ locale: 'en-US', hospital: { locale: 'en-IN' } })

    await portalProfilePATCH(
      makeReq('/api/patient-portal/profile', 'PATCH', {
        locale: 'en-US',
        id: 'patient-2',
        patientId: 'patient-2',
      })
    )

    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'patient-1' } })
    )
  })

  it('clears the override to null', async () => {
    signedInAsPatient()
    prisma.patient.update.mockResolvedValue({ locale: null, hospital: { locale: 'en-IN' } })

    const res = await portalProfilePATCH(
      makeReq('/api/patient-portal/profile', 'PATCH', { locale: null })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.locale).toBeNull()
    expect(body.effectiveLocale).toBe('en-IN')
  })

  it('rejects an unsupported locale with 400', async () => {
    signedInAsPatient()

    const res = await portalProfilePATCH(
      makeReq('/api/patient-portal/profile', 'PATCH', { locale: 'fr-FR' })
    )

    expect(res.status).toBe(400)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('returns the override and the resolved locale', async () => {
    signedInAsPatient()
    prisma.patient.findUnique.mockResolvedValue({
      firstName: 'Ravi',
      lastName: 'Kumar',
      locale: 'en-US',
      hospital: { locale: 'en-IN' },
    })

    const res = await portalProfileGET(makeReq('/api/patient-portal/profile'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.locale).toBe('en-US')
    expect(body.effectiveLocale).toBe('en-US')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Request-scoped resolution
// ═════════════════════════════════════════════════════════════════════════════

describe('getLocaleForRequest', () => {
  it('prefers the staff override over the clinic', async () => {
    auth.mockResolvedValue({ user: STAFF })
    prisma.user.findUnique.mockResolvedValue({
      locale: 'en-US',
      hospital: { locale: 'en-IN' },
    })

    expect(await getLocaleForRequest()).toBe('en-US')
  })

  it('inherits the clinic when the staff override is null', async () => {
    auth.mockResolvedValue({ user: STAFF })
    prisma.user.findUnique.mockResolvedValue({
      locale: null,
      hospital: { locale: 'en-US' },
    })

    expect(await getLocaleForRequest()).toBe('en-US')
  })

  // The reason the clinic is joined rather than fetched separately: this runs
  // on every server-rendered request.
  it('reads the user and the clinic in a single query', async () => {
    auth.mockResolvedValue({ user: STAFF })
    prisma.user.findUnique.mockResolvedValue({
      locale: null,
      hospital: { locale: 'en-IN' },
    })

    await getLocaleForRequest()

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
    expect(prisma.hospital.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { locale: true, hospital: { select: { locale: true } } },
    })
  })

  it('falls back to the patient session when there is no staff session', async () => {
    auth.mockResolvedValue(null)
    getAuthenticatedPatient.mockResolvedValue(PATIENT)
    prisma.patient.findUnique.mockResolvedValue({
      locale: 'en-US',
      hospital: { locale: 'en-IN' },
    })

    expect(await getLocaleForRequest()).toBe('en-US')
  })

  it('returns the default for an anonymous request', async () => {
    auth.mockResolvedValue(null)
    getAuthenticatedPatient.mockResolvedValue(null)

    expect(await getLocaleForRequest()).toBe('en-IN')
  })

  // Load-bearing: a formatting concern must never take a page down.
  it('returns the default rather than throwing when the database is down', async () => {
    auth.mockResolvedValue({ user: STAFF })
    prisma.user.findUnique.mockRejectedValue(new Error("Can't reach database server"))

    await expect(getLocaleForRequest()).resolves.toBe('en-IN')
  })

  it('returns the default rather than throwing when auth() fails', async () => {
    auth.mockRejectedValue(new Error('JWT decryption failed'))

    await expect(getLocaleForRequest()).resolves.toBe('en-IN')
  })

  it('falls through an unsupported stored override to the clinic', async () => {
    auth.mockResolvedValue({ user: STAFF })
    prisma.user.findUnique.mockResolvedValue({
      locale: 'de-DE',
      hospital: { locale: 'en-US' },
    })

    expect(await getLocaleForRequest()).toBe('en-US')
  })
})

describe('getLocaleForPatientRequest', () => {
  it('does not consult the staff session', async () => {
    getAuthenticatedPatient.mockResolvedValue(PATIENT)
    prisma.patient.findUnique.mockResolvedValue({
      locale: null,
      hospital: { locale: 'en-US' },
    })

    expect(await getLocaleForPatientRequest()).toBe('en-US')
    expect(auth).not.toHaveBeenCalled()
  })

  it('returns the default when there is no portal cookie', async () => {
    getAuthenticatedPatient.mockResolvedValue(null)

    expect(await getLocaleForPatientRequest()).toBe('en-IN')
  })

  it('returns the default rather than throwing when the lookup fails', async () => {
    getAuthenticatedPatient.mockRejectedValue(new Error('boom'))

    await expect(getLocaleForPatientRequest()).resolves.toBe('en-IN')
  })
})
