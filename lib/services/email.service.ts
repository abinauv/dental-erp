// Email Service with SMTP Support
// Supports: Hostinger, Gmail SMTP, Custom SMTP

import prisma from '@/lib/prisma';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    email: string;
  };
  replyTo?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  patientId?: string;
  templateId?: string;
  attachments?: EmailAttachment[];
  scheduledFor?: Date;
}

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  async initialize() {
    // Load email configuration from settings
    const settings = await prisma.setting.findMany({
      where: {
        category: 'email',
      },
    });

    if (settings.length === 0) {
      throw new Error('Email not configured');
    }

    this.config = {
      host: settings.find(s => s.key === 'email.smtp.host')?.value || '',
      port: parseInt(settings.find(s => s.key === 'email.smtp.port')?.value || '587'),
      secure: settings.find(s => s.key === 'email.smtp.secure')?.value === 'true',
      auth: {
        user: settings.find(s => s.key === 'email.smtp.user')?.value || '',
        pass: settings.find(s => s.key === 'email.smtp.password')?.value || '',
      },
      from: {
        name: settings.find(s => s.key === 'email.from.name')?.value || 'Dr. Dev\'s Dental Hospital',
        email: settings.find(s => s.key === 'email.from.email')?.value || '',
      },
      replyTo: settings.find(s => s.key === 'email.replyTo')?.value,
    };

    if (!this.config.host || !this.config.auth.user || !this.config.auth.pass) {
      throw new Error('Email SMTP configuration incomplete');
    }

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
    } catch (error) {
      throw new Error('Failed to connect to SMTP server');
    }
  }

  async sendEmail(payload: EmailPayload): Promise<string> {
    // Validate email address
    if (!this.isValidEmail(payload.to)) {
      throw new Error('Invalid email address');
    }

    // Check patient preferences if patient is provided
    if (payload.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: payload.patientId },
      });

      if (!preference?.emailEnabled) {
        throw new Error('Patient has disabled email communication');
      }
    }

    // Create email log entry
    const emailLog = await prisma.emailLog.create({
      data: {
        patientId: payload.patientId,
        email: payload.to,
        subject: payload.subject,
        body: payload.body,
        templateId: payload.templateId,
        scheduledFor: payload.scheduledFor,
        status: payload.scheduledFor ? 'PENDING' : 'QUEUED',
        attachments: payload.attachments ? JSON.stringify(payload.attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
        }))) : null,
      },
    });

    // If scheduled for later, return
    if (payload.scheduledFor && payload.scheduledFor > new Date()) {
      return emailLog.id;
    }

    // Send email immediately
    try {
      if (!this.transporter || !this.config) {
        await this.initialize();
      }

      const result = await this.transporter!.sendMail({
        from: `"${this.config!.from.name}" <${this.config!.from.email}>`,
        to: payload.to,
        replyTo: this.config!.replyTo || this.config!.from.email,
        subject: payload.subject,
        html: payload.body,
        attachments: payload.attachments || [],
      });

      // Update email log
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId,
        },
      });

      return emailLog.id;
    } catch (error: any) {
      // Update email log with error
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  async sendBulkEmail(payloads: EmailPayload[]): Promise<string[]> {
    const results = await Promise.allSettled(
      payloads.map(payload => this.sendEmail(payload))
    );

    return results.map((result, index) =>
      result.status === 'fulfilled' ? result.value : ''
    );
  }

  async sendWithTemplate(
    to: string,
    templateId: string,
    variables: Record<string, string>,
    attachments?: EmailAttachment[],
    patientId?: string
  ): Promise<string> {
    const template = await prisma.communicationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive');
    }

    if (template.channel !== 'EMAIL') {
      throw new Error('Template is not for email channel');
    }

    let subject = template.subject || 'Notification from Dr. Dev\'s Dental Hospital';
    let body = template.content;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    return this.sendEmail({
      to,
      subject,
      body,
      patientId,
      templateId,
      attachments,
    });
  }

  async getEmailHistory(filters: {
    patientId?: string;
    email?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.email) where.email = { contains: filters.email };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
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
    });
  }

  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  async trackEmailOpen(emailLogId: string) {
    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: {
        openedAt: new Date(),
      },
    });
  }

  async generateEmailHTML(content: string): Promise<string> {
    // Load email signature from settings
    const signatureSetting = await prisma.setting.findUnique({
      where: { key: 'email.signature' },
    });

    const signature = signatureSetting?.value || '';

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
    <h2>Dr. Dev's Dental Hospital</h2>
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
    `.trim();
  }
}

export const emailService = new EmailService();
