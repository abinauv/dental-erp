# Communication System Documentation

## Overview

The Communication System for Dr. Dev's Dental Hospital provides comprehensive SMS, Email, Template Management, and Patient Feedback capabilities. It supports Indian SMS gateways and SMTP email delivery.

## Features

### 1. SMS Integration
- **Supported Gateways**: MSG91, TextLocal, Fast2SMS, Twilio India
- **Features**:
  - Individual SMS sending
  - Bulk SMS campaigns
  - Template-based messaging
  - Scheduled SMS delivery
  - Delivery status tracking
  - DND registry checking
  - TRAI compliance (9 AM - 9 PM sending window)
  - SMS history and logs

### 2. Email System
- **Features**:
  - SMTP configuration (Hostinger, Gmail, etc.)
  - HTML email templates
  - Attachment support
  - Scheduled email delivery
  - Email tracking (sent, delivered, opened)
  - Email history and logs

### 3. Communication Templates
- **Template Categories**:
  - Appointment (confirmation, reminders)
  - Payment (reminders, receipts)
  - Birthday wishes
  - Promotional messages
  - Follow-up reminders
  - Lab work notifications
  - Prescription alerts
  - General communications

- **Template Variables**:
  - Patient details (name, ID, phone, email)
  - Appointment details (date, time, doctor, chair)
  - Financial details (invoice, amount, balance)
  - Clinic details (name, phone, address)
  - And more...

### 4. Patient Feedback & Surveys
- **Survey Types**:
  - Satisfaction surveys
  - NPS (Net Promoter Score)
  - Feedback collection
  - Testimonials
  - Service quality assessment

- **Features**:
  - Custom survey builder
  - Multiple question types (rating, multiple choice, text)
  - Anonymous surveys option
  - Response analytics
  - Sentiment analysis

### 5. Automated Triggers
- **Automatic Communications**:
  - Appointment reminders (24 hours before)
  - Birthday wishes (sent at 9 AM)
  - Payment reminders (for overdue invoices)
  - Lab work ready notifications
  - Follow-up reminders

## Setup Instructions

### 1. Database Migration

Run Prisma migration to create communication tables:

\`\`\`bash
npm run db:generate
npm run db:push
\`\`\`

### 2. Install Dependencies

The following packages are required:

\`\`\`bash
npm install nodemailer date-fns
npm install -D @types/nodemailer
\`\`\`

### 3. Environment Variables

Add to your `.env` file:

\`\`\`env
# Cron job secret for automated triggers
CRON_SECRET=your-secure-random-secret-key

# Optional: Set to 'production' to disable manual triggers
NODE_ENV=development
\`\`\`

### 4. Configure SMS Gateway

1. Go to **Settings > Communications > SMS Configuration**
2. Select your SMS gateway (MSG91, TextLocal, Fast2SMS, or Twilio)
3. Enter your API Key and Sender ID
4. Configure route (4 for transactional, 1 for promotional)
5. Save settings

**Gateway-specific Setup**:

- **MSG91**: Sign up at https://msg91.com/, get API key and sender ID
- **TextLocal**: Sign up at https://textlocal.in/, get API key
- **Fast2SMS**: Sign up at https://fast2sms.com/, get API key
- **Twilio**: Sign up at https://twilio.com/, get Account SID and Auth Token

### 5. Configure Email (SMTP)

1. Go to **Settings > Communications > Email Configuration**
2. Enter SMTP server details

**Example for Hostinger**:
- SMTP Host: `smtp.hostinger.com`
- SMTP Port: `587` (or `465` for SSL)
- Username: Your email address
- Password: Your email password
- Enable SSL/TLS as needed

**Example for Gmail**:
- SMTP Host: `smtp.gmail.com`
- SMTP Port: `587`
- Username: Your Gmail address
- Password: App-specific password (not your regular password)

3. Configure sender details (From Name, From Email, Reply-To)
4. Save settings

### 6. Seed Default Templates

To create default communication templates, you can call the template service:

\`\`\`typescript
import { templateService } from '@/lib/services/template.service';

await templateService.seedDefaultTemplates();
\`\`\`

Or create an API endpoint to seed templates.

### 7. Setup Automated Triggers (Cron Job)

The system includes automated communication triggers that should run periodically. Set up a cron job to call the triggers endpoint:

**Using cron (Linux/Mac)**:

\`\`\`bash
# Add to crontab (runs every hour)
0 * * * * curl -X POST https://your-domain.com/api/communications/triggers \\
  -H "Authorization: Bearer your-cron-secret-key"
\`\`\`

**Using Vercel Cron Jobs**:

Create \`vercel.json\`:

\`\`\`json
{
  "crons": [
    {
      "path": "/api/communications/triggers",
      "schedule": "0 * * * *"
    }
  ]
}
\`\`\`

**Using External Services** (Cron-job.org, EasyCron, etc.):
- Set URL: `https://your-domain.com/api/communications/triggers`
- Method: POST
- Headers: `Authorization: Bearer your-cron-secret-key`
- Schedule: Every hour

## API Endpoints

### SMS

- `POST /api/communications/sms` - Send individual SMS
- `POST /api/communications/sms/bulk` - Send bulk SMS
- `GET /api/communications/sms` - Get SMS history

### Email

- `POST /api/communications/email` - Send email
- `GET /api/communications/email` - Get email history

### Templates

- `GET /api/communications/templates` - List all templates
- `POST /api/communications/templates` - Create new template
- `GET /api/communications/templates/[id]` - Get template by ID
- `PUT /api/communications/templates/[id]` - Update template
- `DELETE /api/communications/templates/[id]` - Delete template

### Surveys

- `GET /api/communications/surveys` - List all surveys
- `POST /api/communications/surveys` - Create new survey
- `GET /api/communications/surveys/[id]` - Get survey by ID
- `PUT /api/communications/surveys/[id]` - Update survey
- `DELETE /api/communications/surveys/[id]` - Delete survey
- `POST /api/communications/surveys/[id]/responses` - Submit survey response
- `GET /api/communications/surveys/[id]/responses` - Get survey responses

### Automated Triggers

- `POST /api/communications/triggers` - Run all automated triggers (requires auth)

## Usage Examples

### Send SMS

\`\`\`typescript
const response = await fetch('/api/communications/sms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '9876543210',
    message: 'Your appointment is confirmed for tomorrow at 10 AM',
    patientId: 'patient-id', // optional
    templateId: 'template-id', // optional
  }),
});
\`\`\`

### Send Email with Template

\`\`\`typescript
const response = await fetch('/api/communications/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'patient@example.com',
    templateId: 'template-id',
    variables: {
      patientName: 'John Doe',
      appointmentDate: '25-Jan-2026',
      appointmentTime: '10:00 AM',
    },
  }),
});
\`\`\`

### Create Survey

\`\`\`typescript
const response = await fetch('/api/communications/surveys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Post-Treatment Satisfaction Survey',
    surveyType: 'SATISFACTION',
    questions: [
      {
        question: 'How would you rate your overall experience?',
        type: 'rating',
        required: true,
      },
      {
        question: 'Would you recommend us to others?',
        type: 'yes_no',
        required: true,
      },
    ],
  }),
});
\`\`\`

## Patient Communication Preferences

Patients can control their communication preferences:

- SMS enabled/disabled
- Email enabled/disabled
- Appointment reminders
- Payment reminders
- Promotional messages
- Birthday wishes
- Preferred language
- DND registration

## Compliance & Best Practices

### TRAI Compliance (India)
- SMS only sent between 9 AM - 9 PM IST
- DND registry checked before sending
- Patient consent required for promotional messages
- Unsubscribe option in promotional SMS

### Data Privacy
- Patient communication preferences respected
- Secure storage of communication logs
- Audit trail for all communications

### Rate Limiting
- Bulk SMS sent in batches to avoid gateway throttling
- Failed messages automatically retried

## Troubleshooting

### SMS Not Sending
1. Check SMS gateway configuration in settings
2. Verify API key is correct
3. Check sender ID is approved
4. Ensure patient has SMS enabled in preferences
5. Verify phone number format (10-digit Indian number)
6. Check time restrictions (9 AM - 9 PM IST)

### Email Not Sending
1. Check SMTP configuration in settings
2. Verify SMTP credentials
3. Check port and SSL/TLS settings
4. Ensure patient has email enabled in preferences
5. Verify email address format

### Templates Not Working
1. Check template is active
2. Verify all template variables are provided
3. Check template syntax (use {{variableName}})

## Support

For issues or questions:
- Check the logs in the communication history
- Review error messages in the browser console
- Contact system administrator

## Future Enhancements

- WhatsApp Business API integration
- Voice call integration
- Push notifications
- Advanced analytics dashboard
- A/B testing for templates
- Multi-language support for templates
- Campaign scheduling and management
