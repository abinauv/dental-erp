import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import prisma from '@/tests/__mocks__/prisma'

// An admin resetting a staff member's password must change it for web sign-in
// too (Better Auth's credential BaAccount), not only on User.password.

const mockAuth = vi.hoisted(() => ({ requireAuthAndRole: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$10$reset-hash') },
}))

const { PATCH } = await import('@/app/api/staff/[id]/route')

function patch(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest('http://localhost/api/staff/staff-1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'staff-1' }) }
  )
}

describe('PATCH /api/staff/[id] — password reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { id: 'admin-1', role: 'ADMIN', hospitalId: 'h1' } },
    })
    ;(prisma.staff.findUnique as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-9',
      firstName: 'Asha',
      lastName: 'Rao',
      user: { id: 'user-9' },
    })
    ;(prisma.user.update as any).mockResolvedValue({})
    ;(prisma.staff.update as any).mockResolvedValue({ id: 'staff-1' })
    ;(prisma.baAccount.updateMany as any).mockResolvedValue({ count: 1 })
  })

  it('writes the new hash to User.password and the Better Auth credential', async () => {
    const res = await patch({ newPassword: 'NewSecret123!' })

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-9' },
      data: expect.objectContaining({ password: '$2b$10$reset-hash' }),
    })
    expect(prisma.baAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-9', providerId: 'credential' },
      data: { password: '$2b$10$reset-hash' },
    })
  })

  it('leaves the credential alone when the password is not being changed', async () => {
    const res = await patch({ role: 'DOCTOR' })

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalled()
    expect(prisma.baAccount.updateMany).not.toHaveBeenCalled()
    expect(prisma.baAccount.create).not.toHaveBeenCalled()
    expect(prisma.baSession.deleteMany).not.toHaveBeenCalled()
  })

  it('ends the user’s web sessions on a password reset', async () => {
    await patch({ newPassword: 'NewSecret123!' })
    expect(prisma.baSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-9' } })
  })

  it('ends the user’s web sessions when they are deactivated', async () => {
    const res = await patch({ isActive: false })

    expect(res.status).toBe(200)
    expect(prisma.baSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-9' } })
  })

  it('keeps sessions when a user is reactivated', async () => {
    await patch({ isActive: true })
    expect(prisma.baSession.deleteMany).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/staff/[id] — deactivation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { id: 'admin-1', role: 'ADMIN', hospitalId: 'h1' } },
    })
    ;(prisma.staff.findUnique as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-9',
      user: { id: 'user-9' },
    })
  })

  it('deactivates the user and ends their web sessions in one transaction', async () => {
    // DELETE uses the array form of $transaction.
    ;(prisma.$transaction as any).mockImplementationOnce((ops: Promise<unknown>[]) =>
      Promise.all(ops)
    )
    const { DELETE } = await import('@/app/api/staff/[id]/route')
    const res = await DELETE(
      new NextRequest('http://localhost/api/staff/staff-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'staff-1' }) }
    )

    expect(res.status).toBe(200)
    expect(prisma.baSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-9' } })
    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
