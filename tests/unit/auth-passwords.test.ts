// Password change and reset around Better Auth's endpoints (lib/auth-passwords).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const h = vi.hoisted(() => ({ sendPasswordResetEmail: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/email-helpers', () => ({ sendPasswordResetEmail: h.sendPasswordResetEmail }))

import {
  afterPasswordReset,
  checkNewPassword,
  sendResetLink,
  userIdForResetToken,
} from '@/lib/auth-passwords'

const db = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
  db.user.findUnique.mockResolvedValue({ hospitalId: 'h1' })
  db.setting.findMany.mockResolvedValue([])
})

describe('checkNewPassword (before Better Auth sets it)', () => {
  it('refuses a new password that breaks the clinic’s rules', async () => {
    await expect(
      checkNewPassword({
        path: '/change-password',
        userId: 'u1',
        newPassword: 'weakpass',
        currentPassword: 'Old1!pass',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      body: expect.objectContaining({
        code: 'PASSWORD_POLICY',
        message: 'Password must include an uppercase letter, a number and a symbol.',
      }),
    })
    expect(db.setting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hospitalId: 'h1', category: 'security' }),
      })
    )
  })

  it('applies the clinic’s saved rules on a reset too', async () => {
    db.setting.findMany.mockResolvedValue([{ key: 'passwordMinLength', value: '14' }])
    await expect(
      checkNewPassword({ path: '/reset-password', userId: 'u1', newPassword: 'Short1!pass' })
    ).rejects.toMatchObject({ body: expect.objectContaining({ code: 'PASSWORD_POLICY' }) })
    await expect(
      checkNewPassword({ path: '/reset-password', userId: 'u1', newPassword: 'Long-enough-1-Pass' })
    ).resolves.toBeUndefined()
  })

  it('refuses a "change" to the same password', async () => {
    await expect(
      checkNewPassword({
        path: '/change-password',
        userId: 'u1',
        newPassword: 'Same1!pass',
        currentPassword: 'Same1!pass',
      })
    ).rejects.toMatchObject({ body: expect.objectContaining({ code: 'PASSWORD_UNCHANGED' }) })
  })

  it('leaves other endpoints, and an unknown user or token, to Better Auth', async () => {
    await checkNewPassword({ path: '/sign-in/email', userId: 'u1', newPassword: 'x' })
    await checkNewPassword({ path: '/reset-password', userId: null, newPassword: 'x' })
    expect(db.setting.findMany).not.toHaveBeenCalled()
  })
})

describe('userIdForResetToken', () => {
  it('finds the user of an unexpired reset token', async () => {
    db.baVerification = { findFirst: vi.fn().mockResolvedValue({ value: 'u7' }) }
    expect(await userIdForResetToken('tok')).toBe('u7')
    expect(db.baVerification.findFirst).toHaveBeenCalledWith({
      where: { identifier: 'reset-password:tok', expiresAt: { gt: expect.any(Date) } },
      select: { value: true },
    })
    db.baVerification.findFirst.mockResolvedValue(null)
    expect(await userIdForResetToken('gone')).toBeNull()
  })
})

describe('sendResetLink', () => {
  const data = {
    user: { id: 'u1', email: 'asha@clinic.test', name: 'Asha' },
    url: 'http://app/api/auth/reset-password/tok?callbackURL=%2Freset-password',
    token: 'tok',
  }

  it('emails an active user through their clinic', async () => {
    db.user.findUnique.mockResolvedValue({
      isActive: true,
      name: 'Asha Rao',
      email: 'asha@clinic.test',
      hospitalId: 'h1',
      hospital: { isActive: true },
    })
    await sendResetLink(data)
    expect(h.sendPasswordResetEmail).toHaveBeenCalledWith({
      hospitalId: 'h1',
      to: 'asha@clinic.test',
      userName: 'Asha Rao',
      url: data.url,
      token: 'tok',
    })
  })

  it('sends nothing to a deactivated user or clinic', async () => {
    db.user.findUnique.mockResolvedValue({ isActive: false, hospital: { isActive: true } })
    await sendResetLink(data)
    db.user.findUnique.mockResolvedValue({ isActive: true, hospital: { isActive: false } })
    await sendResetLink(data)
    expect(h.sendPasswordResetEmail).not.toHaveBeenCalled()
  })
})

describe('afterPasswordReset', () => {
  it('copies the new hash to User.password and clears a required change', async () => {
    db.baAccount.findFirst = vi.fn().mockResolvedValue({ password: '$2b$10$new' })
    db.user.update.mockResolvedValue({})
    await afterPasswordReset({ user: { id: 'u1' } })
    expect(db.baAccount.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', providerId: 'credential' },
      select: { password: true },
    })
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: '$2b$10$new', mustChangePassword: false },
    })
  })
})
