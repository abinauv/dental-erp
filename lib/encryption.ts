import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set")
  }
  // Key must be 32 bytes for AES-256
  const keyBuffer = Buffer.from(key, "hex")
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    )
  }
  return keyBuffer
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: iv:ciphertext:tag (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const tag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`
}

/**
 * Decrypt a string encrypted with encrypt().
 * Expects format: iv:ciphertext:tag (all hex-encoded)
 */
export function decrypt(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format")
  }

  const iv = Buffer.from(parts[0], "hex")
  const ciphertext = parts[1]
  const tag = Buffer.from(parts[2], "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(ciphertext, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Generate a random 32-byte encryption key as a hex string.
 * Use this to generate the ENCRYPTION_KEY env var value.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex")
}
