import { describe, it, expect, afterEach } from 'vitest'
import { encrypt, decrypt, generateEncryptionKey } from '@/lib/encryption'

describe('Encryption (AES-256-GCM)', () => {
  describe('encrypt() + decrypt() round-trip', () => {
    it('decrypts back to original plaintext', () => {
      const plaintext = 'Hello, DentalERP!'
      const encrypted = encrypt(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })

    it('handles empty string', () => {
      const encrypted = encrypt('')
      expect(decrypt(encrypted)).toBe('')
    })

    it('handles unicode / special characters', () => {
      const plaintext = '₹1,500 — Dr. Müller\'s notes: "tooth #12"'
      const encrypted = encrypt(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })

    it('handles very long text', () => {
      const plaintext = 'A'.repeat(10000)
      const encrypted = encrypt(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })

    it('produces different ciphertext each time (random IV)', () => {
      const plaintext = 'same message'
      const a = encrypt(plaintext)
      const b = encrypt(plaintext)
      expect(a).not.toBe(b)
      expect(decrypt(a)).toBe(plaintext)
      expect(decrypt(b)).toBe(plaintext)
    })
  })

  describe('encrypt() output format', () => {
    it('outputs iv:ciphertext:tag (3 colon-separated hex parts)', () => {
      const encrypted = encrypt('test')
      const parts = encrypted.split(':')
      expect(parts).toHaveLength(3)
      // IV should be 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24)
      // Tag should be 16 bytes = 32 hex chars
      expect(parts[2]).toHaveLength(32)
      // All parts should be hex
      parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/))
    })
  })

  describe('decrypt() error handling', () => {
    it('throws on malformed format (missing parts)', () => {
      expect(() => decrypt('abcdef')).toThrow('Invalid encrypted data format')
    })

    it('throws on tampered ciphertext', () => {
      const encrypted = encrypt('sensitive data')
      const parts = encrypted.split(':')
      parts[1] = parts[1].slice(0, -2) + 'ff'
      expect(() => decrypt(parts.join(':'))).toThrow()
    })

    it('throws on tampered auth tag', () => {
      const encrypted = encrypt('sensitive data')
      const parts = encrypted.split(':')
      parts[2] = '0'.repeat(32)
      expect(() => decrypt(parts.join(':'))).toThrow()
    })
  })

  describe('generateEncryptionKey()', () => {
    it('returns a 64-character hex string', () => {
      const key = generateEncryptionKey()
      expect(key).toHaveLength(64)
      expect(key).toMatch(/^[0-9a-f]{64}$/)
    })

    it('generates unique keys', () => {
      const a = generateEncryptionKey()
      const b = generateEncryptionKey()
      expect(a).not.toBe(b)
    })
  })

  describe('missing ENCRYPTION_KEY', () => {
    const original = process.env.ENCRYPTION_KEY

    afterEach(() => {
      process.env.ENCRYPTION_KEY = original
    })

    it('throws when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set')
    })

    it('throws when ENCRYPTION_KEY has wrong length', () => {
      process.env.ENCRYPTION_KEY = 'abcd1234'
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string')
    })
  })
})
