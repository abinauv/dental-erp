import type Redis from 'ioredis'

// Shared Redis connection for the background job queue.
//
// The queue is OPTIONAL: when REDIS_URL is unset there is no connection and
// callers run their work inline (see lib/queue/enqueue). When it is set, a
// single lazily-created ioredis connection is shared by the queue producer and
// the worker. ioredis is imported dynamically so a deployment without Redis
// never loads it.

let connection: Redis | null | undefined

/** True when a Redis-backed queue is configured. */
export function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL
}

/**
 * Get the shared Redis connection, or null when REDIS_URL is unset so the
 * caller can fall back to running inline.
 */
export async function getRedisConnection(): Promise<Redis | null> {
  if (!isQueueEnabled()) return null
  if (connection !== undefined) return connection

  const { default: IORedis } = await import('ioredis')
  connection = new IORedis(process.env.REDIS_URL!, {
    // BullMQ requires blocking commands, which need this disabled.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  return connection
}

/** Close the shared connection (tests, graceful shutdown). */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit().catch(() => {})
  }
  connection = undefined
}
