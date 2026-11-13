// SMS Service for Indian SMS Gateways
// Supports: MSG91, TextLocal, Fast2SMS, Twilio India

import prisma from '@/lib/prisma'
import { enqueue } from '@/lib/queue'

export interface SMSConfig {
  gateway: 'MSG91' | 'TEXTLOCAL' | 'FAST2SMS' | 'TWILIO'
  apiKey: string
  senderId: string
  route?: string
  authKey?: string
}

export interface SMSPayload {
  hospitalId: string
  phone: string
  message: string
  patientId?: string
  templateId?: string
  scheduledFor?: Date
  // Transactional messages (OTPs, booking confirmations) are exempt from the
  // promotional 9 AM–9 PM window and from marketing DND/consent checks under
  // TRAI rules. Set this for those; leave it off for marketing messages.
  transactional?: boolean
  // Recorded in SMSLog instead of `message`, e.g. with a one-time code
  // masked. The gateway still sends `message`.
  logMessage?: string
}

// Promotional SMS may only go out from 9 AM to 9 PM IST (TRAI).
export function isWithinSmsHours(at: Date = new Date()): boolean {
  const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30
  const hours = new Date(at.getTime() + istOffset).getUTCHours()
  return hours >= 9 && hours < 21
}

class SMSService {
  // The clinic's own gateway settings. Settings are stored per clinic, so
  // they're loaded for each send rather than kept on this shared instance:
  // one clinic's messages must never go out through another clinic's account.
  private async loadConfig(hospitalId: string): Promise<SMSConfig> {
    const settings = await prisma.setting.findMany({
      where: { hospitalId, category: 'sms' },
    })

    if (settings.length === 0) {
      throw new Error('SMS gateway not configured')
    }

    const config: SMSConfig = {
      gateway: (settings.find((s) => s.key === 'sms.gateway')?.value || 'MSG91') as any,
      apiKey: settings.find((s) => s.key === 'sms.apiKey')?.value || '',
      senderId: settings.find((s) => s.key === 'sms.senderId')?.value || '',
      route: settings.find((s) => s.key === 'sms.route')?.value,
      authKey: settings.find((s) => s.key === 'sms.authKey')?.value,
    }

    if (!config.apiKey) {
      throw new Error('SMS API key not configured')
    }
    return config
  }

  /** Check that the clinic has a usable SMS gateway configured. */
  async initialize(hospitalId: string): Promise<void> {
    await this.loadConfig(hospitalId)
  }

  async sendSMS(payload: SMSPayload): Promise<string> {
    // Validate phone number (Indian format)
    if (!this.isValidIndianPhoneNumber(payload.phone)) {
      throw new Error('Invalid phone number format')
    }

    // Check DND registry if patient is provided
    if (payload.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: payload.patientId },
      })

      if (preference?.dndRegistered) {
        throw new Error('Patient is on DND registry')
      }

      if (!preference?.smsEnabled) {
        throw new Error('Patient has disabled SMS communication')
      }
    }

    const scheduled = !!payload.scheduledFor && payload.scheduledFor > new Date()

    // Time restrictions (9 AM to 9 PM IST), promotional only: at the time the
    // message will actually go out.
    if (!payload.transactional) {
      if (scheduled && !isWithinSmsHours(payload.scheduledFor)) {
        throw new Error('SMS can only be scheduled between 9 AM and 9 PM IST')
      }
      if (!scheduled && !isWithinSmsHours()) {
        throw new Error('SMS cannot be sent outside 9 AM - 9 PM IST')
      }
    }

    // A scheduled SMS is sent later from its log row, so the log has to hold
    // the real text.
    if (scheduled && payload.logMessage !== undefined && payload.logMessage !== payload.message) {
      throw new Error('A scheduled SMS cannot have a separate log message')
    }

    // Create SMS log entry
    const smsLog = await prisma.sMSLog.create({
      data: {
        hospitalId: payload.hospitalId,
        patientId: payload.patientId || null,
        phone: payload.phone,
        message: payload.logMessage ?? payload.message,
        templateId: payload.templateId || null,
        scheduledFor: payload.scheduledFor,
        status: payload.scheduledFor ? 'PENDING' : 'QUEUED',
      },
    })

    // Scheduled for later: the row stays PENDING until the outbox sends it
    // when it's due (lib/services/outbox.service.ts).
    if (scheduled) {
      return smsLog.id
    }

    // Transactional messages (OTPs, booking confirmations) are time-sensitive
    // and the caller depends on a synchronous success/failure result, so they
    // always dispatch inline and never defer to the queue, regardless of Redis.
    if (payload.transactional) {
      await this.dispatchLog(smsLog.id, payload)
      return smsLog.id
    }

    // Otherwise dispatch via the queue: with Redis this enqueues and returns
    // immediately, letting the worker send with retries; without one it runs
    // inline and throws on failure, exactly as before.
    await enqueue('send-sms', { smsLogId: smsLog.id, payload }, { jobId: `sms:${smsLog.id}` })

    return smsLog.id
  }

  // Perform the actual gateway send for an already-created SMS log row and
  // record the outcome. This is the unit the queue runs (inline or in the
  // worker); it throws on failure so BullMQ retries and the inline path
  // surfaces the error.
  async dispatchLog(smsLogId: string, payload: SMSPayload): Promise<void> {
    let gateway: string | undefined
    try {
      const config = await this.loadConfig(payload.hospitalId)
      gateway = config.gateway
      const result = await this.sendViaGateway(payload, config)

      await prisma.sMSLog.update({
        where: { id: smsLogId },
        data: {
          status: 'SENT',
          gateway,
          sentAt: new Date(),
          messageId: result.messageId,
          cost: result.cost,
        },
      })
    } catch (error: any) {
      await prisma.sMSLog.update({
        where: { id: smsLogId },
        data: {
          status: 'FAILED',
          gateway,
          failedAt: new Date(),
          errorMessage: error.message,
        },
      })

      throw error
    }
  }

  async sendBulkSMS(payloads: SMSPayload[]): Promise<string[]> {
    const results = await Promise.allSettled(payloads.map((payload) => this.sendSMS(payload)))

    return results.map((result, index) => (result.status === 'fulfilled' ? result.value : ''))
  }

  private async sendViaGateway(
    payload: SMSPayload,
    config: SMSConfig
  ): Promise<{ messageId: string; cost?: number }> {
    switch (config.gateway) {
      case 'MSG91':
        return this.sendViaMSG91(payload, config)
      case 'TEXTLOCAL':
        return this.sendViaTextLocal(payload, config)
      case 'FAST2SMS':
        return this.sendViaFast2SMS(payload, config)
      case 'TWILIO':
        return this.sendViaTwilio(payload, config)
      default:
        throw new Error('Unsupported SMS gateway')
    }
  }

  private async sendViaMSG91(
    payload: SMSPayload,
    config: SMSConfig
  ): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://api.msg91.com/api/v5/flow/'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: config.apiKey || '',
      },
      body: JSON.stringify({
        sender: config.senderId,
        route: config.route || '4',
        country: '91',
        sms: [
          {
            message: payload.message,
            to: [this.normalizePhoneNumber(payload.phone)],
          },
        ],
      }),
    })

    const data = await response.json()

    if (data.type === 'error') {
      throw new Error(data.message || 'Failed to send SMS via MSG91')
    }

    return {
      messageId: data.requestId || data.message_id || '',
      cost: data.cost,
    }
  }

  private async sendViaTextLocal(
    payload: SMSPayload,
    config: SMSConfig
  ): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://api.textlocal.in/send/'

    const params = new URLSearchParams({
      apikey: config.apiKey || '',
      numbers: this.normalizePhoneNumber(payload.phone),
      sender: config.senderId || '',
      message: payload.message,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    const data = await response.json()

    if (data.status !== 'success') {
      throw new Error(data.errors?.[0]?.message || 'Failed to send SMS via TextLocal')
    }

    return {
      messageId: data.messages?.[0]?.id || '',
      cost: data.cost,
    }
  }

  private async sendViaFast2SMS(
    payload: SMSPayload,
    config: SMSConfig
  ): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://www.fast2sms.com/dev/bulkV2'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: config.apiKey || '',
      },
      body: JSON.stringify({
        sender_id: config.senderId,
        message: payload.message,
        route: config.route || 'v3',
        numbers: this.normalizePhoneNumber(payload.phone),
      }),
    })

    const data = await response.json()

    if (!data.return || data.status_code !== 200) {
      throw new Error(data.message || 'Failed to send SMS via Fast2SMS')
    }

    return {
      messageId: data.request_id || '',
    }
  }

  private async sendViaTwilio(
    payload: SMSPayload,
    config: SMSConfig
  ): Promise<{ messageId: string; cost?: number }> {
    // Twilio implementation
    const accountSid = config.authKey
    const authToken = config.apiKey
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const params = new URLSearchParams({
      To: '+91' + this.normalizePhoneNumber(payload.phone),
      From: config.senderId || '',
      Body: payload.message,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: params,
    })

    const data = await response.json()

    if (data.error_code) {
      throw new Error(data.error_message || 'Failed to send SMS via Twilio')
    }

    return {
      messageId: data.sid || '',
    }
  }

  private isValidIndianPhoneNumber(phone: string): boolean {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '')

    // Check if it's a valid 10-digit Indian mobile number
    return /^[6-9]\d{9}$/.test(cleaned)
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters and return 10-digit number
    return phone.replace(/\D/g, '').slice(-10)
  }

  async processTemplate(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await prisma.communicationTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive')
    }

    let content = template.content

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }

    return content
  }

  async getDeliveryStatus(smsLogId: string): Promise<string> {
    const smsLog = await prisma.sMSLog.findUnique({
      where: { id: smsLogId },
    })

    if (!smsLog) {
      throw new Error('SMS log not found')
    }

    // In a real implementation, you would query the gateway API for delivery status
    return smsLog.status
  }

  // Always scoped to one clinic: SMSLog holds every clinic's messages.
  async getSMSHistory(filters: {
    hospitalId: string
    patientId?: string
    phone?: string
    status?: string
    from?: Date
    to?: Date
    limit?: number
  }) {
    const where: any = { hospitalId: filters.hospitalId }

    if (filters.patientId) where.patientId = filters.patientId
    if (filters.phone) where.phone = { contains: filters.phone }
    if (filters.status) where.status = filters.status
    if (filters.from || filters.to) {
      where.createdAt = {}
      if (filters.from) where.createdAt.gte = filters.from
      if (filters.to) where.createdAt.lte = filters.to
    }

    return prisma.sMSLog.findMany({
      where,
      include: {
        template: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 100,
    })
  }

  async checkBalance(): Promise<{ balance: number; currency: string }> {
    // This would query the SMS gateway for current balance
    // Implementation depends on gateway
    return {
      balance: 0,
      currency: 'INR',
    }
  }
}

export const smsService = new SMSService()
