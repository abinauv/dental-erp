import type { EmailPayload } from '@/lib/services/email.service'
import type { SMSPayload } from '@/lib/services/sms.service'

// The single BullMQ queue name. One queue with several named jobs keeps the
// Redis footprint small; the job name selects the handler below.
export const QUEUE_NAME = 'dental-erp-jobs'

// Job name → payload shape. Adding a job here is a type error until a handler
// is registered in `jobHandlers`.
export interface JobPayloads {
  'send-email': { emailLogId: string; payload: EmailPayload }
  'send-sms': { smsLogId: string; payload: SMSPayload }
  'run-communication-triggers': Record<string, never>
}

export type JobName = keyof JobPayloads

// Handler registry. Imports are kept to the service dispatch entrypoints so this
// module stays free of side effects — nothing here runs until a job is
// processed (inline or by the worker). Resolved lazily via dynamic import from
// the producer to avoid an import cycle with the services.
export async function getJobHandlers(): Promise<{
  [K in JobName]: (data: JobPayloads[K]) => Promise<unknown>
}> {
  const [{ emailService }, { smsService }, { communicationTriggersService }] = await Promise.all([
    import('@/lib/services/email.service'),
    import('@/lib/services/sms.service'),
    import('@/lib/services/communication-triggers.service'),
  ])

  return {
    'send-email': ({ emailLogId, payload }) => emailService.dispatchLog(emailLogId, payload),
    'send-sms': ({ smsLogId, payload }) => smsService.dispatchLog(smsLogId, payload),
    'run-communication-triggers': () => communicationTriggersService.runAllTriggers(),
  }
}
