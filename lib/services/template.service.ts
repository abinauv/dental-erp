// Communication Template Service

import prisma from '@/lib/prisma';
import type { CommunicationChannel, TemplateCategory } from '@prisma/client';

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

class TemplateService {
  // Standard template variables
  private readonly standardVariables: TemplateVariable[] = [
    { key: 'patientName', label: 'Patient Name', description: 'Full name of the patient', example: 'John Doe' },
    { key: 'firstName', label: 'First Name', description: 'Patient\'s first name', example: 'John' },
    { key: 'lastName', label: 'Last Name', description: 'Patient\'s last name', example: 'Doe' },
    { key: 'patientId', label: 'Patient ID', description: 'Unique patient identifier', example: 'P001234' },
    { key: 'phone', label: 'Phone Number', description: 'Patient\'s phone number', example: '9876543210' },
    { key: 'email', label: 'Email Address', description: 'Patient\'s email', example: 'john@example.com' },

    { key: 'appointmentDate', label: 'Appointment Date', description: 'Date of appointment', example: '25-Jan-2026' },
    { key: 'appointmentTime', label: 'Appointment Time', description: 'Time of appointment', example: '10:00 AM' },
    { key: 'appointmentNo', label: 'Appointment Number', description: 'Appointment reference number', example: 'APT001234' },
    { key: 'doctorName', label: 'Doctor Name', description: 'Name of the doctor', example: 'Dr. Smith' },
    { key: 'chairNumber', label: 'Chair Number', description: 'Dental chair number', example: '3' },

    { key: 'treatmentName', label: 'Treatment Name', description: 'Name of the treatment/procedure', example: 'Root Canal' },
    { key: 'treatmentCost', label: 'Treatment Cost', description: 'Cost of treatment', example: '₹5,000' },

    { key: 'invoiceNo', label: 'Invoice Number', description: 'Invoice reference number', example: 'INV001234' },
    { key: 'invoiceAmount', label: 'Invoice Amount', description: 'Total invoice amount', example: '₹5,000' },
    { key: 'paidAmount', label: 'Paid Amount', description: 'Amount paid', example: '₹3,000' },
    { key: 'balanceAmount', label: 'Balance Amount', description: 'Remaining balance', example: '₹2,000' },
    { key: 'dueDate', label: 'Due Date', description: 'Payment due date', example: '31-Jan-2026' },

    { key: 'clinicName', label: 'Clinic Name', description: 'Name of the clinic', example: 'Smile Dental Clinic' },
    { key: 'clinicPhone', label: 'Clinic Phone', description: 'Clinic contact number', example: '044-12345678' },
    { key: 'clinicEmail', label: 'Clinic Email', description: 'Clinic email address', example: 'info@yourclinic.com' },
    { key: 'clinicAddress', label: 'Clinic Address', description: 'Clinic full address', example: '123 Main St, Chennai' },

    { key: 'labOrderNo', label: 'Lab Order Number', description: 'Lab work order number', example: 'LAB001234' },
    { key: 'labWorkType', label: 'Lab Work Type', description: 'Type of lab work', example: 'Crown' },

    { key: 'nextVisitDate', label: 'Next Visit Date', description: 'Date of next visit', example: '5-Feb-2026' },
    { key: 'prescriptionNo', label: 'Prescription Number', description: 'Prescription reference', example: 'RX001234' },
  ];

  getStandardVariables(): TemplateVariable[] {
    return this.standardVariables;
  }

  async createTemplate(data: {
    hospitalId: string;
    name: string;
    category: TemplateCategory;
    channel: CommunicationChannel;
    subject?: string;
    content: string;
    language?: string;
    isDefault?: boolean;
  }) {
    return prisma.communicationTemplate.create({
      data: {
        hospitalId: data.hospitalId,
        name: data.name,
        category: data.category,
        channel: data.channel,
        subject: data.subject,
        content: data.content,
        language: data.language || 'en',
        isDefault: data.isDefault || false,
        isActive: true,
      },
    });
  }

  async updateTemplate(id: string, data: {
    name?: string;
    subject?: string;
    content?: string;
    language?: string;
    isActive?: boolean;
    isDefault?: boolean;
  }, hospitalId?: string) {
    // If hospitalId provided, verify ownership first
    if (hospitalId) {
      const existing = await prisma.communicationTemplate.findFirst({
        where: { id, hospitalId },
      });
      if (!existing) {
        throw new Error('Template not found');
      }
    }
    return prisma.communicationTemplate.update({
      where: { id },
      data,
    });
  }

  async getTemplate(id: string, hospitalId?: string) {
    if (hospitalId) {
      return prisma.communicationTemplate.findFirst({
        where: { id, hospitalId },
      });
    }
    return prisma.communicationTemplate.findUnique({
      where: { id },
    });
  }

  async getTemplates(hospitalId: string, filters?: {
    category?: TemplateCategory;
    channel?: CommunicationChannel;
    language?: string;
    isActive?: boolean;
  }) {
    return prisma.communicationTemplate.findMany({
      where: { hospitalId, ...filters },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDefaultTemplate(hospitalId: string, category: TemplateCategory, channel: CommunicationChannel) {
    return prisma.communicationTemplate.findFirst({
      where: {
        hospitalId,
        category,
        channel,
        isDefault: true,
        isActive: true,
      },
    });
  }

  async deleteTemplate(id: string, hospitalId?: string) {
    // If hospitalId provided, verify ownership first
    if (hospitalId) {
      const existing = await prisma.communicationTemplate.findFirst({
        where: { id, hospitalId },
      });
      if (!existing) {
        throw new Error('Template not found');
      }
    }
    return prisma.communicationTemplate.delete({
      where: { id },
    });
  }

  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      // Replace {{variable}} format
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
    }

    return result;
  }

  extractVariables(content: string): string[] {
    const regex = /{{\\s*([a-zA-Z0-9_]+)\\s*}}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  validateTemplate(content: string): {
    isValid: boolean;
    errors: string[];
    unknownVariables: string[];
  } {
    const errors: string[] = [];
    const extractedVars = this.extractVariables(content);
    const knownVars = this.standardVariables.map(v => v.key);
    const unknownVariables = extractedVars.filter(v => !knownVars.includes(v));

    if (unknownVariables.length > 0) {
      errors.push(`Unknown variables found: ${unknownVariables.join(', ')}`);
    }

    // Check for SMS length (if applicable)
    const contentWithoutVars = content.replace(/{{[^}]+}}/g, 'X'.repeat(20));
    if (contentWithoutVars.length > 500) {
      errors.push('Content may be too long for SMS (estimated > 500 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      unknownVariables,
    };
  }

  async seedDefaultTemplates(hospitalId: string) {
    const defaultTemplates = [
      {
        name: 'Appointment Confirmation SMS',
        category: 'APPOINTMENT' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Dear {{patientName}}, your appointment is confirmed for {{appointmentDate}} at {{appointmentTime}} with {{doctorName}}. Chair: {{chairNumber}}. - {{clinicName}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Appointment Reminder SMS',
        category: 'APPOINTMENT' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Reminder: {{patientName}}, you have an appointment tomorrow at {{appointmentTime}} with {{doctorName}}. Please arrive 10 mins early. Call {{clinicPhone}} to reschedule. - {{clinicName}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Birthday Wishes SMS',
        category: 'BIRTHDAY' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Happy Birthday {{firstName}}! 🎂 Wishing you a healthy & joyful year ahead. - Team {{clinicName}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Payment Reminder SMS',
        category: 'PAYMENT' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Dear {{patientName}}, this is a reminder that payment of ₹{{balanceAmount}} for Invoice {{invoiceNo}} is pending. Due date: {{dueDate}}. Pay at {{clinicName}} or call {{clinicPhone}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Payment Received SMS',
        category: 'PAYMENT' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Dear {{patientName}}, we have received your payment of ₹{{paidAmount}} for Invoice {{invoiceNo}}. Thank you! - {{clinicName}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Lab Work Ready SMS',
        category: 'LAB_WORK' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Dear {{patientName}}, your {{labWorkType}} lab work is ready (Order: {{labOrderNo}}). Please schedule an appointment with {{doctorName}}. Call {{clinicPhone}} - {{clinicName}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Follow-up Reminder SMS',
        category: 'FOLLOW_UP' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Dear {{patientName}}, you have a follow-up scheduled for {{nextVisitDate}}. Please call {{clinicPhone}} to confirm or reschedule. - {{clinicName}}',
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Prescription Ready SMS',
        category: 'PRESCRIPTION' as TemplateCategory,
        channel: 'SMS' as CommunicationChannel,
        content: 'Dear {{patientName}}, your prescription ({{prescriptionNo}}) is ready for collection at {{clinicName}}. Available during working hours.',
        language: 'en',
        isDefault: true,
      },
      // Email Templates
      {
        name: 'Appointment Confirmation Email',
        category: 'APPOINTMENT' as TemplateCategory,
        channel: 'EMAIL' as CommunicationChannel,
        subject: 'Appointment Confirmation - {{appointmentNo}}',
        content: `
          <h2>Appointment Confirmed</h2>
          <p>Dear {{patientName}},</p>
          <p>Your appointment has been successfully scheduled.</p>
          <h3>Appointment Details:</h3>
          <ul>
            <li><strong>Date:</strong> {{appointmentDate}}</li>
            <li><strong>Time:</strong> {{appointmentTime}}</li>
            <li><strong>Doctor:</strong> {{doctorName}}</li>
            <li><strong>Chair:</strong> {{chairNumber}}</li>
            <li><strong>Appointment No:</strong> {{appointmentNo}}</li>
          </ul>
          <p>Please arrive 10 minutes before your scheduled time.</p>
          <p>If you need to reschedule, please contact us at {{clinicPhone}}</p>
        `,
        language: 'en',
        isDefault: true,
      },
      {
        name: 'Invoice Email',
        category: 'PAYMENT' as TemplateCategory,
        channel: 'EMAIL' as CommunicationChannel,
        subject: 'Invoice {{invoiceNo}} - {{clinicName}}',
        content: `
          <h2>Invoice</h2>
          <p>Dear {{patientName}},</p>
          <p>Please find your invoice details below:</p>
          <h3>Invoice Details:</h3>
          <ul>
            <li><strong>Invoice No:</strong> {{invoiceNo}}</li>
            <li><strong>Total Amount:</strong> ₹{{invoiceAmount}}</li>
            <li><strong>Paid Amount:</strong> ₹{{paidAmount}}</li>
            <li><strong>Balance:</strong> ₹{{balanceAmount}}</li>
            <li><strong>Due Date:</strong> {{dueDate}}</li>
          </ul>
          <p>The detailed invoice is attached to this email.</p>
          <p>Thank you for choosing {{clinicName}}!</p>
        `,
        language: 'en',
        isDefault: true,
      },
    ];

    for (const template of defaultTemplates) {
      const existing = await prisma.communicationTemplate.findFirst({
        where: {
          hospitalId,
          name: template.name,
          category: template.category,
          channel: template.channel,
        },
      });

      if (!existing) {
        await this.createTemplate({ hospitalId, ...template });
      }
    }
  }
}

export const templateService = new TemplateService();
