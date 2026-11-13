// Runs the outbox (lib/services/outbox.service.ts) on a timer inside the app,
// so scheduled email and SMS go out on any install without extra setup.
// Started once per server by instrumentation.ts.
//
// OUTBOX_INTERVAL_SECONDS sets how often it runs (default 60). Set it to 0 to
// turn the timer off, for example to drive GET /api/cron/outbox from an
// external scheduler instead.

import { logger } from '@/lib/logger'
import { drainOutbox, type OutboxResult } from '@/lib/services/outbox.service'

const DEFAULT_SECONDS = 60
const MIN_SECONDS = 10
// On globalThis so a dev-server reload doesn't start a second timer.
const TIMER_KEY = Symbol.for('dental-erp.outbox-timer')

/** The interval in milliseconds, or 0 when the timer is turned off. */
export function outboxIntervalMs(value = process.env.OUTBOX_INTERVAL_SECONDS): number {
  if (value === undefined || value.trim() === '') return DEFAULT_SECONDS * 1000
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_SECONDS * 1000
  if (seconds === 0) return 0
  return Math.max(seconds, MIN_SECONDS) * 1000
}

function somethingHappened(result: OutboxResult): boolean {
  return [result.email, result.sms].some(
    (r) => r.sent + r.queued + r.failed + r.cancelled + r.expired > 0
  )
}

/**
 * Start the timer. Returns false when it's turned off or already running in
 * this process.
 */
export function startOutboxScheduler(): boolean {
  const store = globalThis as Record<symbol, unknown>
  if (store[TIMER_KEY]) return false

  const intervalMs = outboxIntervalMs()
  if (intervalMs === 0) {
    logger.info('[outbox] in-app sending is off (OUTBOX_INTERVAL_SECONDS=0)')
    return false
  }

  let running = false
  const run = async () => {
    // A slow run (a large backlog, a slow SMTP server) mustn't overlap the next.
    if (running) return
    running = true
    try {
      const result = await drainOutbox()
      if (somethingHappened(result)) logger.info({ outbox: result }, '[outbox] run')
    } catch (err) {
      logger.error({ err }, '[outbox] run failed')
    } finally {
      running = false
    }
  }

  const timer = setInterval(run, intervalMs)
  // Never keep the process alive just for this.
  timer.unref?.()
  store[TIMER_KEY] = timer
  logger.info(`[outbox] sending scheduled email and SMS every ${intervalMs / 1000}s`)
  return true
}

/** Stop the timer (tests). */
export function stopOutboxScheduler(): void {
  const store = globalThis as Record<symbol, unknown>
  const timer = store[TIMER_KEY] as ReturnType<typeof setInterval> | undefined
  if (timer) clearInterval(timer)
  delete store[TIMER_KEY]
}
