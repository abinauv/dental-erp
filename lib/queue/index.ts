import { getRedisConnection, isQueueEnabled } from './connection'
import { QUEUE_NAME, getJobHandlers, type JobName, type JobPayloads } from './jobs'

export { isQueueEnabled } from './connection'
export { QUEUE_NAME, type JobName, type JobPayloads } from './jobs'

// Default job options when Redis is configured. Retries with exponential
// backoff so a transient SMTP/gateway blip is retried rather than lost; failed
// jobs are kept a week for dead-letter inspection, completed jobs trimmed.
export const DEFAULT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
}

export interface EnqueueOptions {
  // Stable id for idempotency: re-enqueuing the same jobId while it is still
  // in the queue is a no-op in BullMQ, so retries/double-clicks don't duplicate.
  jobId?: string
  // Run the job no earlier than this many milliseconds from now.
  delayMs?: number
}

// Lazily-created BullMQ Queue (only when Redis is configured). `any` avoids a
// static type dependency on bullmq so the module loads without it present.
let queue: any

async function getQueue(): Promise<any | null> {
  const connection = await getRedisConnection()
  if (!connection) return null
  if (!queue) {
    const { Queue } = await import('bullmq')
    queue = new Queue(QUEUE_NAME, { connection })
  }
  return queue
}

/**
 * Enqueue a background job.
 *
 * - With Redis configured: the job is added to BullMQ — durable, retried with
 *   backoff, and processed by the worker, surviving process restarts. Returns
 *   immediately without running the work.
 * - Without Redis: the handler runs inline right now and the result is
 *   returned, so behaviour is identical to invoking the work directly. This is
 *   the zero-config default.
 */
export async function enqueue<K extends JobName>(
  name: K,
  data: JobPayloads[K],
  opts: EnqueueOptions = {}
): Promise<{ queued: boolean; result?: unknown }> {
  const q = await getQueue()

  if (q) {
    await q.add(name, data, {
      ...DEFAULT_JOB_OPTS,
      jobId: opts.jobId,
      delay: opts.delayMs,
    })
    return { queued: true }
  }

  // Inline fallback.
  const handlers = await getJobHandlers()
  const result = await (handlers[name] as (d: JobPayloads[K]) => Promise<unknown>)(data)
  return { queued: false, result }
}

/** Close the queue (tests, graceful shutdown). */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close().catch(() => {})
    queue = undefined
  }
}
