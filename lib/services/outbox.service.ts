// Sends scheduled email and SMS when they're due.
//
// A scheduled message is stored as a PENDING EmailLog/SMSLog row with a
// `scheduledFor` time and nothing else happens until it's due. Each run of
// drainOutbox() picks up the rows that are due and hands each to the same
// dispatch job an immediate send uses: with a queue (REDIS_URL) the worker sends
// it with retries; without one it's sent right here.
//
// It runs every minute inside the app (lib/services/outbox-scheduler.ts) and
// from GET /api/cron/outbox. Runs can overlap (several app containers, or the
// route and the in-app timer at once): each row is claimed with a conditional
// update before it's sent, so only one run ever sends it.

import prisma from '@/lib/prisma'
import { enqueue } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { isWithinSmsHours } from '@/lib/services/sms.service'

// A message more than this late is not sent: a reminder or greeting that
// arrives a day or more after its time does more harm than good.
export const MAX_LATENESS_MS = 24 * 60 * 60 * 1000
// Rows per channel per run; anything beyond waits for the next run.
export const BATCH_SIZE = 100

export const NOTE_EXPIRED = 'Not sent: more than 24 hours past its scheduled time.'
export const NOTE_EMAIL_OPTED_OUT = 'Not sent: the patient has turned off email.'
export const NOTE_SMS_OPTED_OUT =
  'Not sent: the patient has turned off SMS or is on the DND registry.'
export const NOTE_ATTACHMENTS = 'Not sent: a scheduled email cannot have attachments.'

export interface ChannelResult {
  /** Sent during this run (no queue). */
  sent: number
  /** Handed to the queue's worker (REDIS_URL set). */
  queued: number
  /** The send was attempted and failed; the row says why. */
  failed: number
  /** Not sent because the patient has opted out, or it can't be sent. */
  cancelled: number
  /** Not sent because it's more than 24 hours late. */
  expired: number
}

export interface OutboxResult {
  email: ChannelResult
  sms: ChannelResult & {
    /** Due SMS left for later because it's outside 9 AM–9 PM IST. */
    heldUntilSmsHours: boolean
  }
}

const emptyResult = (): ChannelResult => ({
  sent: 0,
  queued: 0,
  failed: 0,
  cancelled: 0,
  expired: 0,
})

/** Send every scheduled email and SMS that is due. */
export async function drainOutbox(now: Date = new Date()): Promise<OutboxResult> {
  const cutoff = new Date(now.getTime() - MAX_LATENESS_MS)
  const email = await drainEmail(now, cutoff)
  const sms = await drainSms(now, cutoff)
  return { email, sms }
}

async function drainEmail(now: Date, cutoff: Date): Promise<ChannelResult> {
  const result = emptyResult()

  const expired = await prisma.emailLog.updateMany({
    where: { status: 'PENDING', scheduledFor: { lt: cutoff } },
    data: { status: 'CANCELLED', errorMessage: NOTE_EXPIRED },
  })
  result.expired = expired.count

  const due = await prisma.emailLog.findMany({
    where: { status: 'PENDING', scheduledFor: { gte: cutoff, lte: now } },
    orderBy: { scheduledFor: 'asc' },
    take: BATCH_SIZE,
  })

  for (const row of due) {
    if (!(await claim('email', row.id))) continue

    if (row.attachments) {
      await cancel('email', row.id, NOTE_ATTACHMENTS)
      result.cancelled++
      continue
    }
    if (row.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: row.patientId },
      })
      if (preference && !preference.emailEnabled) {
        await cancel('email', row.id, NOTE_EMAIL_OPTED_OUT)
        result.cancelled++
        continue
      }
    }

    const payload = {
      hospitalId: row.hospitalId,
      to: row.email,
      subject: row.subject,
      body: row.body,
      patientId: row.patientId ?? undefined,
      templateId: row.templateId ?? undefined,
    }
    await dispatch(result, () =>
      enqueue('send-email', { emailLogId: row.id, payload }, { jobId: `email:${row.id}` })
    )
  }

  return result
}

async function drainSms(now: Date, cutoff: Date): Promise<OutboxResult['sms']> {
  const result = { ...emptyResult(), heldUntilSmsHours: false }

  const expired = await prisma.sMSLog.updateMany({
    where: { status: 'PENDING', scheduledFor: { lt: cutoff } },
    data: { status: 'CANCELLED', errorMessage: NOTE_EXPIRED },
  })
  result.expired = expired.count

  // Scheduled SMS are promotional as far as the rules go: outside 9 AM–9 PM
  // IST they wait (still PENDING) for the next run inside the window.
  if (!isWithinSmsHours(now)) {
    result.heldUntilSmsHours = true
    return result
  }

  const due = await prisma.sMSLog.findMany({
    where: { status: 'PENDING', scheduledFor: { gte: cutoff, lte: now } },
    orderBy: { scheduledFor: 'asc' },
    take: BATCH_SIZE,
  })

  for (const row of due) {
    if (!(await claim('sms', row.id))) continue

    if (row.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: row.patientId },
      })
      if (preference && (preference.dndRegistered || !preference.smsEnabled)) {
        await cancel('sms', row.id, NOTE_SMS_OPTED_OUT)
        result.cancelled++
        continue
      }
    }

    const payload = {
      hospitalId: row.hospitalId,
      phone: row.phone,
      message: row.message,
      patientId: row.patientId ?? undefined,
      templateId: row.templateId ?? undefined,
    }
    await dispatch(result, () =>
      enqueue('send-sms', { smsLogId: row.id, payload }, { jobId: `sms:${row.id}` })
    )
  }

  return result
}

// Take the row for this run: PENDING → QUEUED, only if it's still PENDING.
// Another run that got there first leaves the count at 0.
async function claim(channel: 'email' | 'sms', id: string): Promise<boolean> {
  const where = { id, status: 'PENDING' as const }
  const data = { status: 'QUEUED' as const }
  const { count } =
    channel === 'email'
      ? await prisma.emailLog.updateMany({ where, data })
      : await prisma.sMSLog.updateMany({ where, data })
  return count === 1
}

async function cancel(channel: 'email' | 'sms', id: string, note: string): Promise<void> {
  const args = { where: { id }, data: { status: 'CANCELLED' as const, errorMessage: note } }
  if (channel === 'email') await prisma.emailLog.update(args)
  else await prisma.sMSLog.update(args)
}

// The dispatch job records the outcome on the row (SENT, or FAILED with the
// reason) and throws on failure, so a failure here only needs counting.
async function dispatch(
  result: ChannelResult,
  send: () => Promise<{ queued: boolean }>
): Promise<void> {
  try {
    const { queued } = await send()
    if (queued) result.queued++
    else result.sent++
  } catch (err) {
    result.failed++
    logger.warn({ err }, '[outbox] scheduled message failed to send')
  }
}
