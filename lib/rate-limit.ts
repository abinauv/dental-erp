import type { NextRequest } from 'next/server'
import { getRedisConnection } from '@/lib/queue/connection'

// Shared rate limiter.
//
// With REDIS_URL set, counters live in Redis (shared across instances, survive
// restarts) via an atomic INCR+PEXPIRE fixed window. Without it, an in-memory
// per-process window is used — correct for the single-instance default. Use
// `checkRateLimit` (async) in request handlers; `rateLimit` is the sync
// in-memory primitive it falls back to.
//
// It slows abuse; it is not a substitute for auth or strong secrets.

interface Entry {
  count: number
  resetAt: number
}

const buckets = new Map<string, Entry>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * In-memory fixed window. Counts one hit against `key`; blocks once more than
 * `limit` hits occur within `windowMs`, until the window rolls over.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  entry.count++
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now }
  }
  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 }
}

// Atomic fixed-window counter: INCR, set the window on the first hit, and return
// the count plus the remaining TTL so the caller knows Retry-After.
const INCR_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {c, redis.call('PTTL', KEYS[1])}
`

/**
 * Count one hit against `key`, using Redis when configured and the in-memory
 * window otherwise. A Redis error fails open to the in-memory limiter rather
 * than locking everyone out.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = await getRedisConnection()
  if (!redis) return rateLimit(key, limit, windowMs)

  try {
    const [count, pttl] = (await redis.eval(INCR_SCRIPT, 1, `rl:${key}`, String(windowMs))) as [
      number,
      number,
    ]
    const allowed = count <= limit
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterMs: allowed ? 0 : pttl > 0 ? pttl : windowMs,
    }
  } catch {
    return rateLimit(key, limit, windowMs)
  }
}

/** Best-effort client IP from proxy headers, for keying anonymous limits. */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/** Drop expired in-memory buckets so the map doesn't grow without bound. */
export function pruneRateLimits(now: number = Date.now()): void {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

/** Test helper: clear in-memory state. */
export function _resetRateLimits(): void {
  buckets.clear()
}
