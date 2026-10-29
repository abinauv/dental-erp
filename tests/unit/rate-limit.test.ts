import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { rateLimit, pruneRateLimits, _resetRateLimits } from '@/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    _resetRateLimits()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows up to the limit then blocks', () => {
    const key = 'k'
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).allowed).toBe(true)
    }
    const blocked = rateLimit(key, 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    const key = 'k'
    rateLimit(key, 1, 60_000)
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false)

    vi.advanceTimersByTime(60_001)
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true)
  })

  it('tracks separate keys independently', () => {
    expect(rateLimit('a', 1, 60_000).allowed).toBe(true)
    expect(rateLimit('a', 1, 60_000).allowed).toBe(false)
    // Different key is unaffected.
    expect(rateLimit('b', 1, 60_000).allowed).toBe(true)
  })

  it('prunes expired buckets', () => {
    rateLimit('a', 1, 1_000)
    expect(rateLimit('a', 1, 1_000).allowed).toBe(false)
    vi.advanceTimersByTime(1_001)
    pruneRateLimits()
    // After pruning the expired bucket, the key starts fresh.
    expect(rateLimit('a', 1, 1_000).allowed).toBe(true)
  })
})
