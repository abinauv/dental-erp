import { timingSafeEqual } from 'crypto'

/**
 * Compare a signature we computed with one we received, in constant time, so
 * response timing can't be used to guess a valid signature byte by byte.
 */
export function signaturesMatch(expected: string, received: unknown): boolean {
  if (typeof received !== 'string') return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}
