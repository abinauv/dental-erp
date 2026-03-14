// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
}))

vi.mock('@/lib/services/email.service', () => ({
  emailService: {
    sendEmail: mockSendEmail,
  },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { sendInviteEmail, sendVerificationEmail } from '@/lib/email-helpers'

// ═════════════════════════════════════════════════════════════════════════════
// sendInviteEmail
// ═════════════════════════════════════════════════════════════════════════════

describe('sendInviteEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends invite email with correct subject and content', async () => {
    mockSendEmail.mockResolvedValue(undefined)

    const result = await sendInviteEmail({
      to: 'john@example.com',
      inviteeName: 'John',
      hospitalName: 'Smile Dental',
      role: 'DOCTOR',
      inviterName: 'Admin User',
      token: 'abc123',
    })

    expect(result).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.to).toBe('john@example.com')
    expect(call.subject).toContain('Smile Dental')
    expect(call.body).toContain('John')
    expect(call.body).toContain('Smile Dental')
    expect(call.body).toContain('Admin User')
    expect(call.body).toContain('Doctor') // role formatted
    expect(call.body).toContain('abc123') // token in link
  })

  it('returns false on email send failure', async () => {
    mockSendEmail.mockRejectedValue(new Error('SMTP error'))

    const result = await sendInviteEmail({
      to: 'john@example.com',
      inviteeName: 'John',
      hospitalName: 'Smile Dental',
      role: 'ADMIN',
      inviterName: 'Admin User',
      token: 'abc123',
    })

    expect(result).toBe(false)
  })

  it('includes invite link with token', async () => {
    mockSendEmail.mockResolvedValue(undefined)

    await sendInviteEmail({
      to: 'jane@example.com',
      inviteeName: 'Jane',
      hospitalName: 'Clinic',
      role: 'STAFF',
      inviterName: 'Admin',
      token: 'xyz789',
    })

    const html = mockSendEmail.mock.calls[0][0].body
    expect(html).toContain('/invite/accept?token=xyz789')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// sendVerificationEmail
// ═════════════════════════════════════════════════════════════════════════════

describe('sendVerificationEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends verification email with correct subject and content', async () => {
    mockSendEmail.mockResolvedValue(undefined)

    const result = await sendVerificationEmail({
      to: 'admin@example.com',
      userName: 'Admin',
      hospitalName: 'New Clinic',
      token: 'verify123',
    })

    expect(result).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.to).toBe('admin@example.com')
    expect(call.subject).toContain('Verify')
    expect(call.body).toContain('Admin')
    expect(call.body).toContain('New Clinic')
    expect(call.body).toContain('/verify-email?token=verify123')
  })

  it('returns false on email send failure', async () => {
    mockSendEmail.mockRejectedValue(new Error('Connection timeout'))

    const result = await sendVerificationEmail({
      to: 'admin@example.com',
      userName: 'Admin',
      hospitalName: 'New Clinic',
      token: 'verify123',
    })

    expect(result).toBe(false)
  })

  it('generates proper HTML wrapper', async () => {
    mockSendEmail.mockResolvedValue(undefined)

    await sendVerificationEmail({
      to: 'test@test.com',
      userName: 'Test',
      hospitalName: 'Test Clinic',
      token: 'token1',
    })

    const html = mockSendEmail.mock.calls[0][0].body
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('DentalERP')
    expect(html).toContain('Verify your email')
    expect(html).toContain('24 hours') // expiry note
  })
})
