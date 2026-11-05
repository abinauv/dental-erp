import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockLogger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

const { syncCredentialAccount, mirrorCredentialPassword, credentialAccountId } =
  await import('@/lib/auth-credentials')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('syncCredentialAccount', () => {
  it('creates the credential row with the deterministic id when the user has none', async () => {
    const db = {
      baAccount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
      },
    }

    await syncCredentialAccount(db as any, 'u1', '$2b$10$hash')

    expect(db.baAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', providerId: 'credential' },
      data: { password: '$2b$10$hash' },
    })
    expect(db.baAccount.create).toHaveBeenCalledWith({
      data: {
        id: 'bacred_u1',
        accountId: 'u1',
        providerId: 'credential',
        userId: 'u1',
        password: '$2b$10$hash',
      },
    })
  })

  it('updates the existing credential and does not create a second one', async () => {
    const db = {
      baAccount: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
    }

    await syncCredentialAccount(db as any, 'u1', '$2b$10$new')

    expect(db.baAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', providerId: 'credential' },
      data: { password: '$2b$10$new' },
    })
    expect(db.baAccount.create).not.toHaveBeenCalled()
  })

  it('uses the same id scheme as the 20261029130000 backfill', () => {
    expect(credentialAccountId('abc123')).toBe('bacred_abc123')
  })
})

describe('mirrorCredentialPassword (Better Auth account hook)', () => {
  it('copies a credential hash onto User.password', async () => {
    ;(prisma.user.update as any).mockResolvedValue({})

    await mirrorCredentialPassword({
      providerId: 'credential',
      userId: 'u1',
      password: '$2b$10$changed',
    })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: '$2b$10$changed' },
    })
  })

  it('ignores non-credential accounts (e.g. OIDC)', async () => {
    await mirrorCredentialPassword({ providerId: 'oidc', userId: 'u1', password: undefined })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('ignores a credential account that carries no password', async () => {
    await mirrorCredentialPassword({ providerId: 'credential', userId: 'u1' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('logs instead of throwing when the mirror write fails', async () => {
    ;(prisma.user.update as any).mockRejectedValue(new Error('db down'))

    await expect(
      mirrorCredentialPassword({ providerId: 'credential', userId: 'u1', password: 'h' })
    ).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
      'Failed to mirror credential password to User.password'
    )
  })
})
