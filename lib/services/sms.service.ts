// SMS Service for Indian SMS Gateways
// Supports: MSG91, TextLocal, Fast2SMS, Twilio India

import prisma from '@/lib/prisma';

export interface SMSConfig {
  gateway: 'MSG91' | 'TEXTLOCAL' | 'FAST2SMS' | 'TWILIO';
  apiKey: string;
  senderId: string;
  route?: string;
  authKey?: string;
}

export interface SMSPayload {
  phone: string;
  message: string;
  patientId?: string;
  templateId?: string;
  scheduledFor?: Date;
}

class SMSService {
  private config: SMSConfig | null = null;

  async initialize() {
    // Load SMS configuration from settings
    const settings = await prisma.setting.findMany({
      where: {
        category: 'sms',
      },
    });

    if (settings.length === 0) {
      throw new Error('SMS gateway not configured');
    }

    this.config = {
      gateway: (settings.find(s => s.key === 'sms.gateway')?.value || 'MSG91') as any,
      apiKey: settings.find(s => s.key === 'sms.apiKey')?.value || '',
      senderId: settings.find(s => s.key === 'sms.senderId')?.value || '',
      route: settings.find(s => s.key === 'sms.route')?.value,
      authKey: settings.find(s => s.key === 'sms.authKey')?.value,
    };

    if (!this.config.apiKey) {
      throw new Error('SMS API key not configured');
    }
  }

  async sendSMS(payload: SMSPayload): Promise<string> {
    // Validate phone number (Indian format)
    if (!this.isValidIndianPhoneNumber(payload.phone)) {
      throw new Error('Invalid phone number format');
    }

    // Check DND registry if patient is provided
    if (payload.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: payload.patientId },
      });

      if (preference?.dndRegistered) {
        throw new Error('Patient is on DND registry');
      }

      if (!preference?.smsEnabled) {
        throw new Error('Patient has disabled SMS communication');
      }
    }

    // Check time restrictions (9 AM to 9 PM IST)
    if (!this.isWithinAllowedTime()) {
      throw new Error('SMS cannot be sent outside 9 AM - 9 PM IST');
    }

    // Create SMS log entry
    const smsLog = await prisma.sMSLog.create({
      data: {
        patientId: payload.patientId,
        phone: payload.phone,
        message: payload.message,
        templateId: payload.templateId,
        scheduledFor: payload.scheduledFor,
        status: payload.scheduledFor ? 'PENDING' : 'QUEUED',
        gateway: this.config?.gateway,
      },
    });

    // If scheduled for later, return
    if (payload.scheduledFor && payload.scheduledFor > new Date()) {
      return smsLog.id;
    }

    // Send SMS immediately
    try {
      await this.initialize();
      const result = await this.sendViaGateway(payload);

      // Update SMS log
      await prisma.sMSLog.update({
        where: { id: smsLog.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId,
          cost: result.cost,
        },
      });

      return smsLog.id;
    } catch (error: any) {
      // Update SMS log with error
      await prisma.sMSLog.update({
        where: { id: smsLog.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  async sendBulkSMS(payloads: SMSPayload[]): Promise<string[]> {
    const results = await Promise.allSettled(
      payloads.map(payload => this.sendSMS(payload))
    );

    return results.map((result, index) =>
      result.status === 'fulfilled' ? result.value : ''
    );
  }

  private async sendViaGateway(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    if (!this.config) {
      await this.initialize();
    }

    switch (this.config?.gateway) {
      case 'MSG91':
        return this.sendViaMSG91(payload);
      case 'TEXTLOCAL':
        return this.sendViaTextLocal(payload);
      case 'FAST2SMS':
        return this.sendViaFast2SMS(payload);
      case 'TWILIO':
        return this.sendViaTwilio(payload);
      default:
        throw new Error('Unsupported SMS gateway');
    }
  }

  private async sendViaMSG91(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://api.msg91.com/api/v5/flow/';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': this.config?.apiKey || '',
      },
      body: JSON.stringify({
        sender: this.config?.senderId,
        route: this.config?.route || '4',
        country: '91',
        sms: [
          {
            message: payload.message,
            to: [this.normalizePhoneNumber(payload.phone)],
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.type === 'error') {
      throw new Error(data.message || 'Failed to send SMS via MSG91');
    }

    return {
      messageId: data.requestId || data.message_id || '',
      cost: data.cost,
    };
  }

  private async sendViaTextLocal(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://api.textlocal.in/send/';

    const params = new URLSearchParams({
      apikey: this.config?.apiKey || '',
      numbers: this.normalizePhoneNumber(payload.phone),
      sender: this.config?.senderId || '',
      message: payload.message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.errors?.[0]?.message || 'Failed to send SMS via TextLocal');
    }

    return {
      messageId: data.messages?.[0]?.id || '',
      cost: data.cost,
    };
  }

  private async sendViaFast2SMS(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://www.fast2sms.com/dev/bulkV2';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': this.config?.apiKey || '',
      },
      body: JSON.stringify({
        sender_id: this.config?.senderId,
        message: payload.message,
        route: this.config?.route || 'v3',
        numbers: this.normalizePhoneNumber(payload.phone),
      }),
    });

    const data = await response.json();

    if (!data.return || data.status_code !== 200) {
      throw new Error(data.message || 'Failed to send SMS via Fast2SMS');
    }

    return {
      messageId: data.request_id || '',
    };
  }

  private async sendViaTwilio(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    // Twilio implementation
    const accountSid = this.config?.authKey;
    const authToken = this.config?.apiKey;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams({
      To: '+91' + this.normalizePhoneNumber(payload.phone),
      From: this.config?.senderId || '',
      Body: payload.message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: params,
    });

    const data = await response.json();

    if (data.error_code) {
      throw new Error(data.error_message || 'Failed to send SMS via Twilio');
    }

    return {
      messageId: data.sid || '',
    };
  }

  private isValidIndianPhoneNumber(phone: string): boolean {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if it's a valid 10-digit Indian mobile number
    return /^[6-9]\d{9}$/.test(cleaned);
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters and return 10-digit number
    return phone.replace(/\D/g, '').slice(-10);
  }

  private isWithinAllowedTime(): boolean {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();

    // Allow SMS between 9 AM and 9 PM IST
    return hours >= 9 && hours < 21;
  }

  async processTemplate(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await prisma.communicationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive');
    }

    let content = template.content;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return content;
  }

  async getDeliveryStatus(smsLogId: string): Promise<string> {
    const smsLog = await prisma.sMSLog.findUnique({
      where: { id: smsLogId },
    });

    if (!smsLog) {
      throw new Error('SMS log not found');
    }

    // In a real implementation, you would query the gateway API for delivery status
    return smsLog.status;
  }

  async getSMSHistory(filters: {
    patientId?: string;
    phone?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.phone) where.phone = { contains: filters.phone };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
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
    });
  }

  async checkBalance(): Promise<{ balance: number; currency: string }> {
    // This would query the SMS gateway for current balance
    // Implementation depends on gateway
    return {
      balance: 0,
      currency: 'INR',
    };
  }
}

export const smsService = new SMSService();
