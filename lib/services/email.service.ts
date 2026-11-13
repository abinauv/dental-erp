// Email Service with SMTP Support
// Supports: Hostinger, Gmail SMTP, Custom SMTP

import prisma from '@/lib/prisma'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { enqueue } from '@/lib/queue'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: {
    name: string
    email: string
  }
  replyTo?: string
}

export interface EmailPayload {
  hospitalId: string
  to: string
  subject: string
  body: string
  patientId?: string
  templateId?: string
  attachments?: EmailAttachment[]
  scheduledFor?: Date
  // Recorded in EmailLog instead of `body`, e.g. with a sign-in or invite link
  // removed: staff can read the email log. The email itself still sends
  // `body`.
  logBody?: string
}

export interface EmailAttachment {
  filename: string
  path?: string
  content?: Buffer | string
  contentType?: string
}

interface ClinicTransport {
  // The settings the transporter was built from; a change rebuilds it.
  key: string
  transporter: Transporter
  config: EmailConfig
}

class EmailService {
  // One SMTP transporter per clinic. Settings are stored per clinic, so one
  // clinic's mail must never go out through another clinic's account.
  private transports = new Map<string, ClinicTransport>()

  private async loadConfig(hospitalId: string): Promise<EmailConfig> {
    const settings = await prisma.setting.findMany({
      where: { hospitalId, category: 'email' },
    })

    if (settings.length === 0) {
      throw new Error('Email not configured')
    }

    const config: EmailConfig = {
      host: settings.find((s) => s.key === 'email.smtp.host')?.value || '',
      port: parseInt(settings.find((s) => s.key === 'email.smtp.port')?.value || '587'),
      secure: settings.find((s) => s.key === 'email.smtp.secure')?.value === 'true',
      auth: {
        user: settings.find((s) => s.key === 'email.smtp.user')?.value || '',
        pass: settings.find((s) => s.key === 'email.smtp.password')?.value || '',
      },
      from: {
        name: settings.find((s) => s.key === 'email.from.name')?.value || 'Your Dental Clinic',
        email: settings.find((s) => s.key === 'email.from.email')?.value || '',
      },
      replyTo: settings.find((s) => s.key === 'email.replyTo')?.value,
    }

    if (!config.host || !config.auth.user || !config.auth.pass) {
      throw new Error('Email SMTP configuration incomplete')
    }
    return config
  }

  // The clinic's transporter, built (and its connection verified) the first
  // time and again whenever the clinic's settings change.
  private async getTransport(hospitalId: string): Promise<ClinicTransport> {
    const config = await this.loadConfig(hospitalId)
    const key = JSON.stringify(config)
    const cached = this.transports.get(hospitalId)
    if (cached?.key === key) return cached

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    })

    try {
      await transporter.verify()
    } catch (error) {
      throw new Error('Failed to connect to SMTP server')
    }

    cached?.transporter.close()
    const entry = { key, transporter, config }
    this.transports.set(hospitalId, entry)
    return entry
  }

  /** Check that the clinic's SMTP settings are complete and connect. */
  async initialize(hospitalId: string): Promise<void> {
    await this.getTransport(hospitalId)
  }

  async sendEmail(payload: EmailPayload): Promise<string> {
    // Validate email address
    if (!this.isValidEmail(payload.to)) {
      throw new Error('Invalid email address')
    }

    // Check patient preferences if patient is provided. A patient without a
    // preferences record has the default: email on.
    if (payload.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: payload.patientId },
      })

      if (preference && !preference.emailEnabled) {
        throw new Error('Patient has disabled email communication')
      }
    }

    const scheduled = !!payload.scheduledFor && payload.scheduledFor > new Date()

    // A scheduled email is sent later from its log row, which keeps only the
    // attachments' names, not their content.
    if (scheduled && payload.attachments?.length) {
      throw new Error('A scheduled email cannot have attachments')
    }
    // Nor can it hold back part of its body from the log.
    if (scheduled && payload.logBody !== undefined && payload.logBody !== payload.body) {
      throw new Error('A scheduled email cannot have a separate log body')
    }

    // Create email log entry
    const emailLog = await prisma.emailLog.create({
      data: {
        hospitalId: payload.hospitalId,
        patientId: payload.patientId || null,
        email: payload.to,
        subject: payload.subject,
        body: payload.logBody ?? payload.body,
        templateId: payload.templateId || null,
        scheduledFor: payload.scheduledFor,
        status: payload.scheduledFor ? 'PENDING' : 'QUEUED',
        attachments: payload.attachments
          ? JSON.stringify(
              payload.attachments.map((a) => ({
                filename: a.filename,
                contentType: a.contentType,
              }))
            )
          : null,
      },
    })

    // Scheduled for later: the row stays PENDING until the outbox sends it
    // when it's due (lib/services/outbox.service.ts).
    if (scheduled) {
      return emailLog.id
    }

    // Dispatch now. With a queue configured this enqueues and returns
    // immediately, letting the worker send with retries; without one it runs
    // inline and throws on failure, exactly as before.
    await enqueue(
      'send-email',
      { emailLogId: emailLog.id, payload },
      { jobId: `email:${emailLog.id}` }
    )

    return emailLog.id
  }

  // Perform the actual SMTP send for an already-created email log row and record
  // the outcome. This is the unit the queue runs (inline or in the worker); it
  // throws on failure so BullMQ retries and the inline path surfaces the error.
  async dispatchLog(emailLogId: string, payload: EmailPayload): Promise<void> {
    try {
      const { transporter, config } = await this.getTransport(payload.hospitalId)

      const result = await transporter.sendMail({
        from: `"${config.from.name}" <${config.from.email}>`,
        to: payload.to,
        replyTo: config.replyTo || config.from.email,
        subject: payload.subject,
        html: payload.body,
        attachments: this.normalizeAttachments(payload.attachments),
      })

      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId,
        },
      })
    } catch (error: any) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message,
        },
      })

      throw error
    }
  }

  // Attachment Buffers survive an in-process (inline) enqueue unchanged, but a
  // Buffer round-tripped through Redis/JSON comes back as
  // { type: 'Buffer', data: number[] }; rehydrate those so nodemailer gets a
  // real Buffer either way.
  private normalizeAttachments(attachments?: EmailAttachment[]): EmailAttachment[] {
    if (!attachments) return []
    return attachments.map((a) => {
      const content = a.content as any
      if (
        content &&
        typeof content === 'object' &&
        content.type === 'Buffer' &&
        Array.isArray(content.data)
      ) {
        return { ...a, content: Buffer.from(content.data) }
      }
      return a
    })
  }

  async sendBulkEmail(payloads: EmailPayload[]): Promise<string[]> {
    const results = await Promise.allSettled(payloads.map((payload) => this.sendEmail(payload)))

    return results.map((result, index) => (result.status === 'fulfilled' ? result.value : ''))
  }

  async sendWithTemplate(
    hospitalId: string,
    to: string,
    templateId: string,
    variables: Record<string, string>,
    attachments?: EmailAttachment[],
    patientId?: string
  ): Promise<string> {
    // Only this clinic's templates.
    const template = await prisma.communicationTemplate.findFirst({
      where: { id: templateId, hospitalId },
    })

    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive')
    }

    if (template.channel !== 'EMAIL') {
      throw new Error('Template is not for email channel')
    }

    let subject = template.subject || 'Notification from Your Dental Clinic'
    let body = template.content

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      subject = subject.replace(regex, value)
      body = body.replace(regex, value)
    }

    return this.sendEmail({
      hospitalId,
      to,
      subject,
      body,
      patientId,
      templateId,
      attachments,
    })
  }

  // Always scoped to one clinic: EmailLog holds every clinic's messages.
  async getEmailHistory(filters: {
    hospitalId: string
    patientId?: string
    email?: string
    status?: string
    from?: Date
    to?: Date
    limit?: number
  }) {
    const where: any = { hospitalId: filters.hospitalId }

    if (filters.patientId) where.patientId = filters.patientId
    if (filters.email) where.email = { contains: filters.email }
    if (filters.status) where.status = filters.status
    if (filters.from || filters.to) {
      where.createdAt = {}
      if (filters.from) where.createdAt.gte = filters.from
      if (filters.to) where.createdAt.lte = filters.to
    }

    return prisma.emailLog.findMany({
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

  private isValidEmail(email: string): boolean {
    // Length-capped (RFC 5321), and domain labels can't contain dots, so no two
    // parts of the pattern compete for the same characters: matching stays
    // linear on hostile input.
    const regex = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
    return email.length <= 254 && regex.test(email)
  }

  async trackEmailOpen(emailLogId: string) {
    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: {
        openedAt: new Date(),
      },
    })
  }

  async generateEmailHTML(content: string): Promise<string> {
    // Load email signature from settings
    const signatureSetting = await prisma.setting.findFirst({
      where: { key: 'email.signature' },
    })

    const signature = signatureSetting?.value || ''

    // Basic HTML template
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #0066cc;
      color: white;
      padding: 20px;
      text-align: center;
    }
    .content {
      padding: 20px;
      background-color: #f9f9f9;
    }
    .footer {
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #ddd;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      background-color: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Your Dental Clinic</h2>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    ${signature}
    <p>This is an automated email. Please do not reply to this email.</p>
  </div>
</body>
</html>
    `.trim()
  }
}

export const emailService = new EmailService()
