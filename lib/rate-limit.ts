// Minimal in-memory fixed-window rate limiter.
//
// Better Auth's built-in rateLimit covers its own endpoints (web /sign-in/email,
// /sign-in/oauth2). The mobile Bearer-token login (app/api/auth/mobile-token)
// is a custom route outside Better Auth, so it uses this to throttle
// brute-force attempts.
//
// Scope: suitable for the single-instance default. State is per-process, so with
// multiple instances each limits independently — front the app with a
// reverse-proxy limiter (or move this to the queue's Redis) for a hard global
// cap. It slows brute-force; it is not a substitute for strong passwords.

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
 * Count one hit against `key`. Returns allowed=false once more than `limit`
 * hits occur within `windowMs`, until the window rolls over.
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

/** Drop expired buckets so the map doesn't grow without bound. */
export function pruneRateLimits(now: number = Date.now()): void {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

/** Test helper: clear all state. */
export function _resetRateLimits(): void {
  buckets.clear()
}
