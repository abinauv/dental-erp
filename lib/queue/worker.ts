import { getRedisConnection } from './connection'
import { QUEUE_NAME, getJobHandlers, type JobName } from './jobs'
import { logger } from '@/lib/logger'

// Background job worker. Run as a separate long-lived process:
//
//   npm run worker        (tsx lib/queue/worker.ts)
//
// It only does anything when REDIS_URL is set; without Redis all work runs
// inline in the web process (see lib/queue/enqueue) and no worker is needed.

/**
 * Start the BullMQ worker. Returns the Worker instance, or null when Redis is
 * not configured (nothing to process).
 */
export async function startWorker(): Promise<any | null> {
  const connection = await getRedisConnection()
  if (!connection) {
    logger.warn('[queue] REDIS_URL not set — worker has nothing to do; jobs run inline.')
    return null
  }

  const { Worker } = await import('bullmq')
  const handlers = await getJobHandlers()

  const worker = new Worker(
    QUEUE_NAME,
    async (job: { name: string; data: unknown }) => {
      const handler = handlers[job.name as JobName]
      if (!handler) throw new Error(`No handler registered for job "${job.name}"`)
      return handler(job.data as never)
    },
    {
      connection,
      // Modest concurrency: external SMTP/SMS gateways rate-limit, and jobs are
      // I/O bound, so a handful at a time is plenty.
      concurrency: Number(process.env.QUEUE_CONCURRENCY) || 5,
    }
  )

  worker.on('completed', (job: { id?: string; name: string }) => {
    logger.info(`[queue] completed ${job.name} (${job.id})`)
  })
  worker.on(
    'failed',
    (job: { id?: string; name: string; attemptsMade?: number } | undefined, err: Error) => {
      // A job that has exhausted its attempts stays in the failed set
      // (removeOnFail age) as the dead-letter record.
      logger.error(
        `[queue] failed ${job?.name} (${job?.id}) attempt ${job?.attemptsMade}: ${err.message}`
      )
    }
  )

  logger.info(`[queue] worker started on "${QUEUE_NAME}"`)
  return worker
}

// Run when invoked directly (tsx lib/queue/worker.ts), not when imported.
// `import.meta.url` vs argv[1] is the ESM equivalent of require.main === module.
const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`

if (invokedDirectly) {
  startWorker().catch((err) => {
    logger.error({ err }, '[queue] worker failed to start:')
    process.exit(1)
  })
}
