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
      hospitalId: 'h1',
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
    // The email log row needs the clinic (a blank one failed its foreign key,
    // so no invite was ever sent).
    expect(call.hospitalId).toBe('h1')
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
      hospitalId: 'h1',
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
      hospitalId: 'h1',
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
      hospitalId: 'h1',
      to: 'admin@example.com',
      userName: 'Admin',
      hospitalName: 'New Clinic',
      token: 'verify123',
    })

    expect(result).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.hospitalId).toBe('h1')
    expect(call.to).toBe('admin@example.com')
    expect(call.subject).toContain('Verify')
    expect(call.body).toContain('Admin')
    expect(call.body).toContain('New Clinic')
    expect(call.body).toContain('/verify-email?token=verify123')
  })

  it('returns false on email send failure', async () => {
    mockSendEmail.mockRejectedValue(new Error('Connection timeout'))

    const result = await sendVerificationEmail({
      hospitalId: 'h1',
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
      hospitalId: 'h1',
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

// ═════════════════════════════════════════════════════════════════════════════
// The email log never holds a link that grants access
// ═════════════════════════════════════════════════════════════════════════════

describe('tokens are kept out of the email log', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logs the invite email with its token removed, and sends it with the token', async () => {
    mockSendEmail.mockResolvedValue(undefined)
    await sendInviteEmail({
      hospitalId: 'h1',
      to: 'new.admin@example.com',
      inviteeName: 'New Admin',
      hospitalName: 'Smile Dental',
      role: 'ADMIN',
      inviterName: 'Owner',
      token: 'InviteTok3n0123456789abcdefABCDEF',
    })

    const { body, logBody } = mockSendEmail.mock.calls[0][0]
    expect(body).toContain('/invite/accept?token=InviteTok3n0123456789abcdefABCDEF')
    expect(logBody).not.toContain('InviteTok3n')
    expect(logBody).toContain('/invite/accept?token=[removed]')
    // Everything else is the same email.
    expect(logBody.replaceAll('[removed]', 'InviteTok3n0123456789abcdefABCDEF')).toBe(body)
  })

  it('logs the verification email with its token removed', async () => {
    mockSendEmail.mockResolvedValue(undefined)
    await sendVerificationEmail({
      hospitalId: 'h1',
      to: 'owner@example.com',
      userName: 'Owner',
      hospitalName: 'Smile Dental',
      token: 'VerifyTok3n0123456789abcdefABCDEF',
    })

    const { body, logBody } = mockSendEmail.mock.calls[0][0]
    expect(body).toContain('/verify-email?token=VerifyTok3n0123456789abcdefABCDEF')
    expect(logBody).not.toContain('VerifyTok3n')
    expect(logBody).toContain('/verify-email?token=[removed]')
  })
})
