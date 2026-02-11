// Automated Communication Triggers Service
// Handles automatic sending of appointment reminders, birthday wishes, payment reminders, etc.

import prisma from '@/lib/prisma';
import { smsService } from './sms.service';
import { emailService } from './email.service';
import { templateService } from './template.service';
import { addDays, startOfDay, endOfDay, format, subDays } from 'date-fns';

class CommunicationTriggersService {
  // Send appointment reminders (24 hours before)
  async sendAppointmentReminders24Hours() {
    const tomorrow = addDays(new Date(), 1);
    const tomorrowStart = startOfDay(tomorrow);
    const tomorrowEnd = endOfDay(tomorrow);

    // Get all appointments scheduled for tomorrow
    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledDate: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
      include: {
        patient: true,
        doctor: {
          include: {
            user: true,
          },
        },
      },
    });

    console.log(`Found ${appointments.length} appointments for tomorrow`);

    for (const appointment of appointments) {
      try {
        // Check if patient has communication preferences
        const preferences = await prisma.patientCommunicationPreference.findUnique({
          where: { patientId: appointment.patientId },
        });

        if (preferences && !preferences.appointmentReminders) {
          console.log(`Patient ${appointment.patientId} has disabled appointment reminders`);
          continue;
        }

        // Get clinic info for variables
        const clinicInfo = await prisma.hospital.findUnique({ where: { id: appointment.hospitalId }, select: { name: true, phone: true } });

        const variables = {
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          firstName: appointment.patient.firstName,
          appointmentDate: format(appointment.scheduledDate, 'dd-MMM-yyyy'),
          appointmentTime: appointment.scheduledTime,
          appointmentNo: appointment.appointmentNo,
          doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
          chairNumber: appointment.chairNumber?.toString() || 'TBA',
          clinicName: clinicInfo?.name || "Dr. Dev's Dental Hospital",
          clinicPhone: clinicInfo?.phone || '',
        };

        // Send SMS if enabled
        if (preferences?.smsEnabled !== false && appointment.patient.phone) {
          const smsTemplate = await templateService.getDefaultTemplate(appointment.hospitalId, 'APPOINTMENT', 'SMS');

          if (smsTemplate) {
            const message = templateService.replaceVariables(smsTemplate.content, variables);

            await smsService.sendSMS({
              phone: appointment.patient.phone,
              message,
              patientId: appointment.patientId,
              templateId: smsTemplate.id,
            });

            console.log(`SMS reminder sent to ${appointment.patient.phone} for appointment ${appointment.appointmentNo}`);
          }
        }

        // Send Email if enabled
        if (preferences?.emailEnabled !== false && appointment.patient.email) {
          const emailTemplate = await templateService.getDefaultTemplate(appointment.hospitalId, 'APPOINTMENT', 'EMAIL');

          if (emailTemplate) {
            const body = await emailService.generateEmailHTML(
              templateService.replaceVariables(emailTemplate.content, variables)
            );

            await emailService.sendEmail({
              to: appointment.patient.email,
              subject: templateService.replaceVariables(emailTemplate.subject || 'Appointment Reminder', variables),
              body,
              patientId: appointment.patientId,
              templateId: emailTemplate.id,
            });

            console.log(`Email reminder sent to ${appointment.patient.email} for appointment ${appointment.appointmentNo}`);
          }
        }

        // Update appointment reminder record
        await prisma.appointmentReminder.create({
          data: {
            appointmentId: appointment.id,
            reminderType: 'SMS',
            scheduledFor: new Date(),
            sentAt: new Date(),
            status: 'SENT',
          },
        });

      } catch (error) {
        console.error(`Error sending reminder for appointment ${appointment.appointmentNo}:`, error);
      }
    }
  }

  // Send birthday wishes
  async sendBirthdayWishes() {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    // Get all patients with birthday today
    const patients = await prisma.patient.findMany({
      where: {
        isActive: true,
        dateOfBirth: {
          not: null,
        },
      },
    });

    // Filter patients with birthday today
    const birthdayPatients = patients.filter(patient => {
      if (!patient.dateOfBirth) return false;
      const dob = new Date(patient.dateOfBirth);
      return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDate;
    });

    console.log(`Found ${birthdayPatients.length} patients with birthday today`);

    for (const patient of birthdayPatients) {
      try {
        const preferences = await prisma.patientCommunicationPreference.findUnique({
          where: { patientId: patient.id },
        });

        if (preferences && !preferences.birthdayWishes) {
          continue;
        }

        const clinicInfo = await prisma.hospital.findUnique({ where: { id: patient.hospitalId }, select: { name: true, phone: true } });

        const variables = {
          patientName: `${patient.firstName} ${patient.lastName}`,
          firstName: patient.firstName,
          clinicName: clinicInfo?.name || "Dr. Dev's Dental Hospital",
        };

        // Send SMS
        if (preferences?.smsEnabled !== false && patient.phone) {
          const smsTemplate = await templateService.getDefaultTemplate(patient.hospitalId, 'BIRTHDAY', 'SMS');

          if (smsTemplate) {
            const message = templateService.replaceVariables(smsTemplate.content, variables);

            await smsService.sendSMS({
              phone: patient.phone,
              message,
              patientId: patient.id,
              templateId: smsTemplate.id,
            });
          }
        }

      } catch (error) {
        console.error(`Error sending birthday wish to patient ${patient.id}:`, error);
      }
    }
  }

  // Send payment reminders for overdue invoices
  async sendPaymentReminders() {
    const today = new Date();

    // Get invoices that are overdue or due soon
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'],
        },
        balanceAmount: {
          gt: 0,
        },
        dueDate: {
          lte: today,
        },
      },
      include: {
        patient: true,
      },
    });

    console.log(`Found ${overdueInvoices.length} overdue invoices`);

    for (const invoice of overdueInvoices) {
      try {
        const preferences = await prisma.patientCommunicationPreference.findUnique({
          where: { patientId: invoice.patientId },
        });

        if (preferences && !preferences.paymentReminders) {
          continue;
        }

        const clinicInfo = await prisma.hospital.findUnique({ where: { id: invoice.hospitalId }, select: { name: true, phone: true } });

        const variables = {
          patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
          firstName: invoice.patient.firstName,
          invoiceNo: invoice.invoiceNo,
          invoiceAmount: `₹${invoice.totalAmount.toFixed(2)}`,
          balanceAmount: `₹${invoice.balanceAmount.toFixed(2)}`,
          dueDate: invoice.dueDate ? format(invoice.dueDate, 'dd-MMM-yyyy') : 'ASAP',
          clinicName: clinicInfo?.name || "Dr. Dev's Dental Hospital",
          clinicPhone: clinicInfo?.phone || '',
        };

        // Send SMS
        if (preferences?.smsEnabled !== false && invoice.patient.phone) {
          const smsTemplate = await templateService.getDefaultTemplate(invoice.hospitalId, 'PAYMENT', 'SMS');

          if (smsTemplate) {
            const message = templateService.replaceVariables(smsTemplate.content, variables);

            await smsService.sendSMS({
              phone: invoice.patient.phone,
              message,
              patientId: invoice.patientId,
              templateId: smsTemplate.id,
            });
          }
        }

      } catch (error) {
        console.error(`Error sending payment reminder for invoice ${invoice.invoiceNo}:`, error);
      }
    }
  }

  // Send lab work ready notifications
  async sendLabWorkReadyNotifications() {
    const labOrders = await prisma.labOrder.findMany({
      where: {
        status: 'READY',
        deliveredDate: null, // Not yet delivered to patient
      },
      include: {
        patient: true,
      },
    });

    console.log(`Found ${labOrders.length} ready lab orders`);

    for (const order of labOrders) {
      try {
        const clinicInfo = await prisma.hospital.findUnique({ where: { id: order.hospitalId }, select: { name: true, phone: true } });

        const variables = {
          patientName: `${order.patient.firstName} ${order.patient.lastName}`,
          firstName: order.patient.firstName,
          labOrderNo: order.orderNumber,
          labWorkType: order.workType,
          clinicName: clinicInfo?.name || "Dr. Dev's Dental Hospital",
          clinicPhone: clinicInfo?.phone || '',
        };

        // Send SMS
        if (order.patient.phone) {
          const smsTemplate = await templateService.getDefaultTemplate(order.hospitalId, 'LAB_WORK', 'SMS');

          if (smsTemplate) {
            const message = templateService.replaceVariables(smsTemplate.content, variables);

            await smsService.sendSMS({
              phone: order.patient.phone,
              message,
              patientId: order.patientId,
              templateId: smsTemplate.id,
            });
          }
        }

        // Update status to prevent duplicate notifications
        await prisma.labOrder.update({
          where: { id: order.id },
          data: {
            notes: (order.notes || '') + '\nReady notification sent on ' + format(new Date(), 'dd-MMM-yyyy HH:mm'),
          },
        });

      } catch (error) {
        console.error(`Error sending lab work notification for order ${order.orderNumber}:`, error);
      }
    }
  }

  // Send Google Review request SMS after appointment completion
  // Only sends to patients who rated satisfaction >= 4/5 ("review gating")
  async sendReviewRequests() {
    // Check if review automation is enabled for each hospital
    const hospitals = await prisma.hospital.findMany({
      select: { id: true },
    });

    for (const hospital of hospitals) {
      try {
        // Check if Google Review automation is enabled
        const reviewSettings = await prisma.setting.findMany({
          where: {
            hospitalId: hospital.id,
            key: { in: ['google_review_url', 'auto_review_requests', 'review_request_delay_hours'] },
          },
        });

        const settingsMap: Record<string, string> = {};
        for (const s of reviewSettings) settingsMap[s.key] = s.value;

        const reviewUrl = settingsMap['google_review_url'];
        const autoEnabled = settingsMap['auto_review_requests'] === 'true';
        const delayHours = parseInt(settingsMap['review_request_delay_hours'] || '2', 10);

        if (!reviewUrl || !autoEnabled) continue;

        // Find appointments completed recently (within the delay window)
        const windowStart = new Date(Date.now() - (delayHours + 1) * 3600000);
        const windowEnd = new Date(Date.now() - delayHours * 3600000);

        const completedAppointments = await prisma.appointment.findMany({
          where: {
            hospitalId: hospital.id,
            status: 'COMPLETED',
            updatedAt: { gte: windowStart, lte: windowEnd },
          },
          include: {
            patient: true,
          },
        });

        for (const appt of completedAppointments) {
          try {
            // Review gating: check if patient has a recent positive survey response (rating >= 4)
            const recentPositiveResponse = await prisma.surveyResponse.findFirst({
              where: {
                patientId: appt.patientId,
                rating: { gte: 4 },
                createdAt: { gte: subDays(new Date(), 30) },
              },
            });

            // Only send review request if patient gave positive feedback
            if (!recentPositiveResponse) continue;

            // Check preferences
            const preferences = await prisma.patientCommunicationPreference.findUnique({
              where: { patientId: appt.patientId },
            });
            if (preferences && !preferences.promotionalMessages) continue;

            // Check if we already sent a review request recently (avoid duplicates)
            const recentReviewSms = await prisma.sMSLog.findFirst({
              where: {
                hospitalId: hospital.id,
                patientId: appt.patientId,
                message: { contains: 'review' },
                createdAt: { gte: subDays(new Date(), 30) },
              },
            });
            if (recentReviewSms) continue;

            const clinicInfo = await prisma.hospital.findUnique({ where: { id: appt.hospitalId }, select: { name: true, phone: true } });
            const clinicName = clinicInfo?.name || "Our Dental Clinic";

            if (appt.patient.phone) {
              const message = `Hi ${appt.patient.firstName}, thank you for visiting ${clinicName}! We'd love to hear about your experience. Please leave us a review: ${reviewUrl}`;

              await smsService.sendSMS({
                phone: appt.patient.phone,
                message,
                patientId: appt.patientId,
              });

              console.log(`Review request sent to ${appt.patient.phone}`);
            }
          } catch (err) {
            console.error(`Error sending review request for appointment ${appt.id}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error processing review requests for hospital ${hospital.id}:`, err);
      }
    }
  }

  // Main cron job runner - should be called periodically (e.g., every hour)
  async runAllTriggers() {
    console.log('Starting communication triggers...');

    try {
      await this.sendAppointmentReminders24Hours();
      await this.sendBirthdayWishes();
      await this.sendPaymentReminders();
      await this.sendLabWorkReadyNotifications();
      await this.sendReviewRequests();

      console.log('Communication triggers completed successfully');
    } catch (error) {
      console.error('Error running communication triggers:', error);
    }
  }
}

export const communicationTriggersService = new CommunicationTriggersService();
