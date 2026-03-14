'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Calendar,
  Receipt,
  MessageSquare,
  Users,
  Shield,
  Link2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Cpu,
  Upload,
  CreditCard,
  Mail,
  Smartphone,
  Star,
  Video,
  BookOpen,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react'

interface SetupStep {
  title: string
  description: string
  steps: string[]
  tips?: string[]
  link?: { label: string; href: string }
  externalLinks?: { label: string; url: string }[]
  videoId?: string
}

interface SetupSection {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  priority: 'essential' | 'recommended' | 'optional'
  estimatedTime: string
  guides: SetupStep[]
}

const setupSections: SetupSection[] = [
  {
    id: 'clinic',
    title: 'Clinic Information',
    description: 'Set up your clinic profile, logo, address, and working hours',
    icon: Building2,
    color: 'text-blue-600 bg-blue-50',
    priority: 'essential',
    estimatedTime: '10 min',
    guides: [
      {
        title: 'Add Your Clinic Logo',
        description: 'Upload your clinic logo that will appear on invoices, prescriptions, and the patient portal.',
        steps: [
          'Go to Settings → Clinic Information',
          'Click the camera icon on the placeholder image at the top',
          'Select your clinic logo from your computer (JPEG, PNG, or SVG, max 2MB)',
          'The logo will be uploaded automatically — you\'ll see a preview',
          'Click "Save Changes" at the bottom of the page',
        ],
        tips: [
          'Use a square image (e.g., 512×512 pixels) for best results',
          'PNG with transparent background works best',
          'The logo appears on printed invoices and prescriptions',
        ],
        link: { label: 'Go to Clinic Settings', href: '/settings/clinic' },
      },
      {
        title: 'Fill in Clinic Details',
        description: 'Add your clinic name, phone number, email, address, and registration details.',
        steps: [
          'Go to Settings → Clinic Information',
          'Fill in the "Basic Information" section: Clinic Name and Tagline',
          'Fill in "Contact Information": Primary Phone, Email, and Website',
          'Fill in "Address": Street Address, City, State, and Pincode',
          'Fill in "Registration & Tax": GST Number and PAN (if applicable)',
          'Click "Save Changes"',
        ],
        tips: [
          'GST Number format: 29XXXXX1234X1ZX (15 characters)',
          'PAN format: ABCDE1234F (10 characters)',
          'These details appear on your invoices automatically',
        ],
        link: { label: 'Go to Clinic Settings', href: '/settings/clinic' },
      },
      {
        title: 'Set Working Hours',
        description: 'Configure your clinic\'s opening and closing hours for each day of the week.',
        steps: [
          'Go to Settings → Clinic Information, scroll to "Working Hours"',
          'For each day, set the Opening Time and Closing Time',
          'Toggle "Closed" for days when the clinic is not open (e.g., Sundays)',
          'Use the "Copy to All" button to apply one day\'s hours to all days',
          'Click "Save Changes"',
        ],
        tips: [
          'Working hours are used for appointment scheduling — patients can only book during these hours',
          'You can set different hours for different days (e.g., half-day on Saturdays)',
        ],
        link: { label: 'Go to Clinic Settings', href: '/settings/clinic' },
      },
      {
        title: 'Add Bank & UPI Details',
        description: 'Add your bank account and UPI information for payment collection.',
        steps: [
          'Go to Settings → Clinic Information, scroll to "Bank & Payment Details"',
          'Enter your Bank Name, Account Number, and IFSC Code',
          'Enter your UPI ID (e.g., yourclinic@upi)',
          'Click "Save Changes"',
        ],
        tips: [
          'Bank details appear on invoices so patients can make bank transfers',
          'Double-check the IFSC code — incorrect IFSC will cause payment failures',
        ],
        link: { label: 'Go to Clinic Settings', href: '/settings/clinic' },
      },
    ],
  },
  {
    id: 'staff',
    title: 'Staff & User Accounts',
    description: 'Add your team members so they can log in and use the system',
    icon: Users,
    color: 'text-indigo-600 bg-indigo-50',
    priority: 'essential',
    estimatedTime: '5 min per staff',
    guides: [
      {
        title: 'Add a Staff Member',
        description: 'Create accounts for your doctors, receptionists, and other staff.',
        steps: [
          'Go to Staff from the left sidebar',
          'Click the "+ Add Staff" button in the top-right',
          'Fill in the staff member\'s details: Name, Email, Phone, and Role',
          'Choose a Role: ADMIN (full access), DOCTOR, RECEPTIONIST, ACCOUNTANT, or LAB_TECH',
          'Set a temporary password — the staff member will be asked to change it on first login',
          'Click "Create Staff" to save',
        ],
        tips: [
          'Each role has different permissions — receptionists can book appointments but can\'t change settings',
          'Doctors can view and create treatments, prescriptions, and medical records',
          'Only ADMIN users can access Settings and manage other staff',
          'Share the login URL and temporary password with each staff member',
        ],
        link: { label: 'Go to Staff Management', href: '/staff' },
      },
      {
        title: 'Invite Staff via Email',
        description: 'Send an invitation email so staff can set up their own accounts.',
        steps: [
          'Go to Staff → Invites tab',
          'Click "+ Send Invite"',
          'Enter the staff member\'s email address and select their role',
          'Click "Send Invite" — they\'ll receive an email with a signup link',
          'The invite appears as "Pending" until they accept',
        ],
        tips: [
          'Email invites require your SMTP/email to be configured first (see Email Setup below)',
          'Invites expire after 7 days — you can resend if needed',
        ],
        link: { label: 'Go to Staff Invites', href: '/staff/invites' },
      },
    ],
  },
  {
    id: 'procedures',
    title: 'Dental Procedures & Pricing',
    description: 'Set up your list of dental procedures with prices',
    icon: ClipboardList,
    color: 'text-pink-600 bg-pink-50',
    priority: 'essential',
    estimatedTime: '15 min',
    guides: [
      {
        title: 'Add Your Dental Procedures',
        description: 'Create your catalog of dental procedures with codes, pricing, and instructions.',
        steps: [
          'Go to Settings → Procedure Settings',
          'Click "+ New Procedure"',
          'Fill in the Code (e.g., "RCT", "SCALING"), Name, and Category',
          'Set the Base Price — this is the default price shown on invoices',
          'Optionally add Duration (in minutes), Materials, and Pre/Post instructions',
          'Click "Save" to add the procedure',
          'Repeat for all your dental procedures',
        ],
        tips: [
          'Common categories: PREVENTIVE (cleaning, scaling), RESTORATIVE (fillings), ENDODONTIC (root canal), PROSTHODONTIC (crowns, dentures), ORTHODONTIC (braces), ORAL_SURGERY (extraction), COSMETIC (whitening), DIAGNOSTIC (X-ray)',
          'Prices can be changed for individual patients at the time of billing',
          'You can import procedures from your old system using Data Import',
          'Mark procedures as inactive instead of deleting them — this preserves billing history',
        ],
        link: { label: 'Go to Procedure Settings', href: '/settings/procedures' },
      },
    ],
  },
  {
    id: 'appointments',
    title: 'Appointment Settings',
    description: 'Configure time slots, working hours, and holiday calendar',
    icon: Calendar,
    color: 'text-green-600 bg-green-50',
    priority: 'essential',
    estimatedTime: '5 min',
    guides: [
      {
        title: 'Configure Time Slots',
        description: 'Set up how long each appointment slot is and the buffer time between appointments.',
        steps: [
          'Go to Settings → Appointment Settings',
          'Set "Default Slot Duration" — this is how long each appointment lasts (e.g., 30 minutes)',
          'Set "Buffer Time" — gap between appointments for cleanup/preparation (e.g., 10 minutes)',
          'Set "Clinic Start Time" and "Clinic End Time" to match your working hours',
          'Optionally set a lunch break time range',
          'Click "Save Settings"',
        ],
        tips: [
          'A 30-minute slot with 10-minute buffer means 40 minutes between appointment starts',
          'You can override slot duration for specific appointments when booking',
        ],
        link: { label: 'Go to Appointment Settings', href: '/settings/appointments' },
      },
      {
        title: 'Add Holidays',
        description: 'Block out dates when your clinic is closed so patients can\'t book on those days.',
        steps: [
          'Go to Settings → Appointment Settings',
          'Scroll down to the "Holiday Calendar" section',
          'Enter the Holiday Name (e.g., "Diwali", "Christmas")',
          'Select the Date',
          'Click "Add Holiday"',
          'The holiday will appear in the list below — appointments can\'t be booked on that date',
        ],
        tips: [
          'Add all national and regional holidays at the start of the year',
          'You can delete a holiday if plans change',
          'Existing appointments on that date are NOT automatically cancelled — cancel them manually if needed',
        ],
        link: { label: 'Go to Appointment Settings', href: '/settings/appointments' },
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Tax Setup',
    description: 'Configure GST, invoice format, and payment terms',
    icon: Receipt,
    color: 'text-purple-600 bg-purple-50',
    priority: 'essential',
    estimatedTime: '5 min',
    guides: [
      {
        title: 'Set Up GST & Tax Rates',
        description: 'Configure your CGST and SGST percentages for automatic tax calculation on invoices.',
        steps: [
          'Go to Settings → Billing Settings',
          'In the "Tax Configuration" section, enter your CGST Rate (e.g., 9%)',
          'Enter your SGST Rate (e.g., 9%) — total GST will be shown (e.g., 18%)',
          'Click "Save Settings"',
        ],
        tips: [
          'Standard dental GST in India: CGST 9% + SGST 9% = 18% total',
          'If your clinic is below the GST threshold (₹20 lakh turnover), you can set both to 0%',
          'Tax is calculated automatically on every invoice',
        ],
        link: { label: 'Go to Billing Settings', href: '/settings/billing' },
      },
      {
        title: 'Customize Invoice Format',
        description: 'Set your invoice prefix, numbering, and footer text.',
        steps: [
          'Go to Settings → Billing Settings',
          'In "Invoice Format", set your Invoice Prefix (e.g., "INV") and Receipt Prefix (e.g., "REC")',
          'Set the Starting Number (e.g., 1001) — invoices will be numbered INV1001, INV1002, etc.',
          'Scroll to "Invoice Footer" and add your Terms & Conditions text',
          'Optionally add Invoice Notes that appear on every invoice',
          'Click "Save Settings"',
        ],
        tips: [
          'If you\'re migrating from another system, set the starting number to continue from where you left off',
          'Common footer text: "Payment is due within 15 days. Thank you for your business."',
        ],
        link: { label: 'Go to Billing Settings', href: '/settings/billing' },
      },
    ],
  },
  {
    id: 'payment-gateway',
    title: 'Online Payment Gateway',
    description: 'Accept online payments from patients via Razorpay, PhonePe, or Paytm',
    icon: CreditCard,
    color: 'text-emerald-600 bg-emerald-50',
    priority: 'recommended',
    estimatedTime: '15-30 min',
    guides: [
      {
        title: 'Set Up Razorpay',
        description: 'Accept credit cards, debit cards, UPI, and net banking payments through Razorpay.',
        steps: [
          'Create a Razorpay account at razorpay.com if you don\'t have one',
          'Complete KYC verification on the Razorpay dashboard (PAN, bank account, business details)',
          'Once verified, go to Razorpay Dashboard → Settings → API Keys',
          'Click "Generate Key" — you\'ll get a Key ID (starts with "rzp_") and a Key Secret',
          'IMPORTANT: Copy the Key Secret immediately — it\'s shown only once!',
          'In DentalERP, go to Settings → Billing Settings → "Payment Gateway" tab',
          'Select "Razorpay" as the gateway',
          'Paste your Key ID and Key Secret in the fields',
          'Toggle "Test Mode" ON for testing first, then switch to OFF for live payments',
          'Toggle "Enable Online Payments" ON',
          'Click "Save Gateway Settings"',
          'Copy the Webhook URL shown and paste it in Razorpay Dashboard → Webhooks → Add Webhook',
        ],
        tips: [
          'Always test with Test Mode ON first — use Razorpay test cards to verify',
          'Razorpay charges ~2% per transaction (varies by payment method)',
          'Settlements happen in T+2 business days to your registered bank account',
          'Keep your Key Secret safe — never share it publicly',
        ],
        link: { label: 'Go to Billing Settings', href: '/settings/billing' },
        externalLinks: [
          { label: 'Create Razorpay Account', url: 'https://dashboard.razorpay.com/signup' },
          { label: 'Razorpay API Keys Guide', url: 'https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/' },
        ],
      },
      {
        title: 'Set Up PhonePe Business',
        description: 'Accept UPI, cards, and wallet payments through PhonePe for Business.',
        steps: [
          'Create a PhonePe Business account at business.phonepe.com',
          'Complete KYC and business verification',
          'Once approved, go to PhonePe Business Dashboard → Developers → API Keys',
          'Note your Merchant ID, Salt Key, and Salt Index',
          'In DentalERP, go to Settings → Billing Settings → "Payment Gateway" tab',
          'Select "PhonePe" as the gateway',
          'Enter your Merchant ID, Salt Key, and Salt Index',
          'Toggle Test/Live mode appropriately',
          'Click "Save Gateway Settings"',
        ],
        tips: [
          'PhonePe is popular for UPI payments in India',
          'PhonePe charges ~1.5-2% per transaction',
          'Make sure your business category is set correctly during KYC',
        ],
        link: { label: 'Go to Billing Settings', href: '/settings/billing' },
        externalLinks: [
          { label: 'PhonePe Business Signup', url: 'https://business.phonepe.com' },
        ],
      },
      {
        title: 'Set Up Paytm Business',
        description: 'Accept payments via Paytm wallet, UPI, cards, and net banking.',
        steps: [
          'Create a Paytm for Business account at business.paytm.com',
          'Complete your business KYC verification',
          'Go to Paytm Business Dashboard → Developer Settings → API Keys',
          'Note your Merchant ID (MID) and Merchant Key',
          'In DentalERP, go to Settings → Billing Settings → "Payment Gateway" tab',
          'Select "Paytm" as the gateway',
          'Enter your Merchant ID and Merchant Key',
          'Set Website to "WEBSTAGING" for testing or "DEFAULT" for live',
          'Click "Save Gateway Settings"',
        ],
        tips: [
          'Use "WEBSTAGING" website value for testing, switch to "DEFAULT" when going live',
          'Paytm offers lower rates for small businesses — check their pricing page',
        ],
        link: { label: 'Go to Billing Settings', href: '/settings/billing' },
        externalLinks: [
          { label: 'Paytm Business Signup', url: 'https://business.paytm.com' },
        ],
      },
    ],
  },
  {
    id: 'sms',
    title: 'SMS Notifications',
    description: 'Send appointment reminders and notifications via SMS to patients',
    icon: Smartphone,
    color: 'text-orange-600 bg-orange-50',
    priority: 'recommended',
    estimatedTime: '15 min',
    guides: [
      {
        title: 'Set Up SMS Gateway (MSG91)',
        description: 'MSG91 is the most popular SMS gateway in India. Here\'s how to connect it.',
        steps: [
          'Create an account at msg91.com',
          'Verify your email and phone number',
          'Go to MSG91 Dashboard → API → Authkey — copy your Auth Key',
          'Create a Sender ID (6 characters, e.g., "DENTAL") — this appears as the sender name',
          'Submit Sender ID for TRAI approval (takes 1-3 business days)',
          'In DentalERP, go to Settings → Communication Settings',
          'Toggle "Enable SMS" ON',
          'Select "MSG91" as the Gateway',
          'Paste your Auth Key and approved Sender ID',
          'Set Route to "4" (Transactional — for appointment reminders)',
          'Click "Save Settings"',
          'Test by entering a phone number and clicking "Send Test SMS"',
        ],
        tips: [
          'SMS can only be sent between 9 AM - 9 PM IST (TRAI regulation)',
          'Route 4 = Transactional (appointment reminders), Route 1 = Promotional (offers)',
          'DND-registered numbers will receive Transactional SMS but not Promotional',
          'SMS costs approximately ₹0.15 - ₹0.25 per message depending on volume',
        ],
        link: { label: 'Go to Communication Settings', href: '/settings/communications' },
        externalLinks: [
          { label: 'Create MSG91 Account', url: 'https://msg91.com/signup' },
        ],
      },
      {
        title: 'Set Up SMS Gateway (Fast2SMS)',
        description: 'Fast2SMS is a budget-friendly option for SMS notifications.',
        steps: [
          'Create an account at fast2sms.com',
          'Go to Dashboard → Dev API — copy your API Key',
          'In DentalERP, go to Settings → Communication Settings',
          'Toggle "Enable SMS" ON',
          'Select "Fast2SMS" as the Gateway',
          'Paste your API Key',
          'Enter a Sender ID (must be approved by Fast2SMS)',
          'Click "Save Settings"',
          'Send a test SMS to verify it works',
        ],
        tips: [
          'Fast2SMS offers prepaid credits — buy only what you need',
          'Approval for Sender ID may take 1-2 days',
        ],
        link: { label: 'Go to Communication Settings', href: '/settings/communications' },
        externalLinks: [
          { label: 'Create Fast2SMS Account', url: 'https://www.fast2sms.com' },
        ],
      },
    ],
  },
  {
    id: 'email',
    title: 'Email Setup (SMTP)',
    description: 'Send emails for appointment confirmations, invoices, and reports',
    icon: Mail,
    color: 'text-red-600 bg-red-50',
    priority: 'recommended',
    estimatedTime: '10 min',
    guides: [
      {
        title: 'Set Up Email with Your Domain',
        description: 'If you have a business email (e.g., info@yourclinic.com) through Hostinger, GoDaddy, etc.',
        steps: [
          'In DentalERP, go to Settings → Communication Settings → Email tab',
          'Toggle "Enable Email" ON',
          'Enter the SMTP settings from your email provider:',
          '  — SMTP Host: e.g., smtp.hostinger.com (check your email provider\'s documentation)',
          '  — SMTP Port: 587 (most common) or 465 (for SSL)',
          '  — SMTP Username: your full email address (e.g., info@yourclinic.com)',
          '  — SMTP Password: your email account password',
          'Toggle "Use SSL" ON if you chose Port 465, leave OFF for Port 587',
          'Set "From Name" to your clinic name (e.g., "Dr. Smith\'s Dental Clinic")',
          'Set "From Email" to your email address',
          'Click "Save Settings"',
          'Enter a test email address and click "Send Test Email" to verify',
        ],
        tips: [
          'Common SMTP servers: Hostinger (smtp.hostinger.com:587), Gmail (smtp.gmail.com:587), Outlook (smtp.office365.com:587)',
          'If using Gmail, you need to create an "App Password" (not your regular password)',
          'Port 587 uses STARTTLS, Port 465 uses SSL — both are secure',
          'If the test email fails, double-check your password and port number',
        ],
        link: { label: 'Go to Communication Settings', href: '/settings/communications' },
      },
      {
        title: 'Set Up Email with Gmail',
        description: 'Use a Gmail account for sending emails. Requires creating an App Password.',
        steps: [
          'Go to your Google Account settings (myaccount.google.com)',
          'Go to Security → 2-Step Verification and enable it (required for App Passwords)',
          'Go to Security → 2-Step Verification → App Passwords',
          'Select "Mail" as the app and "Other" as the device, name it "DentalERP"',
          'Click "Generate" — Google will show a 16-character password. Copy it immediately!',
          'In DentalERP Communication Settings:',
          '  — SMTP Host: smtp.gmail.com',
          '  — SMTP Port: 587',
          '  — Username: your full Gmail address',
          '  — Password: the 16-character App Password (NOT your Gmail password)',
          '  — SSL: OFF (Port 587 uses STARTTLS)',
          'Click "Save Settings" and send a test email',
        ],
        tips: [
          'Gmail allows ~500 emails/day for personal accounts, 2000/day for Workspace',
          'Never use your actual Gmail password — always use an App Password',
          'Gmail shows "Sent on behalf of" in some email clients',
          'For better branding, consider using a custom domain email instead',
        ],
        link: { label: 'Go to Communication Settings', href: '/settings/communications' },
        externalLinks: [
          { label: 'Google App Passwords', url: 'https://myaccount.google.com/apppasswords' },
        ],
      },
    ],
  },
  {
    id: 'google-calendar',
    title: 'Google Calendar Sync',
    description: 'Sync appointments with Google Calendar for easy access on your phone',
    icon: Link2,
    color: 'text-cyan-600 bg-cyan-50',
    priority: 'recommended',
    estimatedTime: '5 min',
    guides: [
      {
        title: 'Connect Google Calendar',
        description: 'Sync your DentalERP appointments to Google Calendar automatically.',
        steps: [
          'Go to Settings → Integrations',
          'In the "Google Calendar" section, click "Connect Google Calendar"',
          'A Google sign-in popup will appear — sign in with the Google account you want to sync to',
          'Grant DentalERP permission to manage your calendar events',
          'Once connected, you\'ll see a "Connected" badge with your Calendar ID',
          'Toggle "Sync Status" to Enabled',
          'Click "Sync Now" to sync existing appointments',
        ],
        tips: [
          'All new appointments will automatically appear in your Google Calendar',
          'Google Calendar events include patient name, procedure, and appointment time',
          'You can view appointments on your phone via the Google Calendar app',
          'To disconnect, click "Disconnect" — this removes sync but doesn\'t delete calendar events',
        ],
        link: { label: 'Go to Integrations', href: '/settings/integrations' },
      },
    ],
  },
  {
    id: 'google-reviews',
    title: 'Google Reviews',
    description: 'Automatically request Google reviews from happy patients',
    icon: Star,
    color: 'text-yellow-600 bg-yellow-50',
    priority: 'optional',
    estimatedTime: '5 min',
    guides: [
      {
        title: 'Set Up Automatic Google Review Requests',
        description: 'Automatically ask patients who rated you 4 or 5 stars to leave a Google review.',
        steps: [
          'First, find your Google Review URL:',
          '  1. Search for your clinic on Google Maps',
          '  2. Click on your clinic listing',
          '  3. Click "Write a Review"',
          '  4. Copy the URL from your browser\'s address bar',
          'In DentalERP, go to Settings → Communication Settings → "Google Reviews" tab',
          'Paste your Google Review URL in the field',
          'Toggle "Auto-Request Reviews" ON',
          'Set "Review Request Delay" (e.g., 2 hours — sends the request 2 hours after the appointment)',
          'Click "Save Settings"',
        ],
        tips: [
          'Review requests are only sent to patients who rated your clinic 4/5 or higher in feedback surveys',
          'Each patient receives at most one review request per 30 days',
          'Patients who opted out of communications will not receive requests',
          'More Google reviews improve your clinic\'s visibility in Google searches',
        ],
        link: { label: 'Go to Communication Settings', href: '/settings/communications' },
      },
    ],
  },
  {
    id: 'patient-portal',
    title: 'Patient Portal',
    description: 'Let patients book appointments and view records online',
    icon: Users,
    color: 'text-violet-600 bg-violet-50',
    priority: 'recommended',
    estimatedTime: '2 min',
    guides: [
      {
        title: 'Enable the Patient Portal',
        description: 'Allow patients to log in, book appointments, view treatment history, and make payments online.',
        steps: [
          'Go to Settings → Clinic Information',
          'Scroll down to the "Patient Portal" section',
          'Toggle "Enable Patient Portal" ON',
          'A portal URL will be generated automatically (e.g., yourclinic.dentalerp.com/portal)',
          'Copy the portal URL and share it with your patients',
          'Click "Save Changes"',
        ],
        tips: [
          'Patients log in using their phone number + OTP (no password needed)',
          'Share the portal link on your website, WhatsApp, or printed cards',
          'Patients can book appointments, view invoices, and see treatment history',
          'You can disable the portal at any time from the same toggle',
        ],
        link: { label: 'Go to Clinic Settings', href: '/settings/clinic' },
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI Assistant Setup',
    description: 'Enable AI-powered features like chat, scheduling suggestions, and billing assistance',
    icon: Sparkles,
    color: 'text-amber-600 bg-amber-50',
    priority: 'optional',
    estimatedTime: '10 min',
    guides: [
      {
        title: 'Get an OpenRouter API Key',
        description: 'DentalERP uses OpenRouter to power its AI features. You\'ll need an API key.',
        steps: [
          'Go to openrouter.ai and create a free account',
          'Click on your profile icon → "Keys" (or go to openrouter.ai/keys)',
          'Click "Create Key" and give it a name like "DentalERP"',
          'Copy the API key (starts with "sk-or-")',
          'Add this key to your DentalERP environment configuration:',
          '  — In your server\'s .env file, add: OPENROUTER_API_KEY=sk-or-your-key-here',
          '  — Restart the application after adding the key',
          'In DentalERP, go to Settings → AI Features and toggle "Enable AI" ON',
        ],
        tips: [
          'OpenRouter provides access to multiple AI models at competitive prices',
          'DentalERP uses cost-effective models — typical monthly cost is ₹100-500 for a small clinic',
          'You can set a monthly budget limit in AI Settings to control spending',
          'Start with "Economy" model and upgrade to "Quality" if needed',
        ],
        link: { label: 'Go to AI Settings', href: '/settings/ai' },
        externalLinks: [
          { label: 'Create OpenRouter Account', url: 'https://openrouter.ai' },
        ],
      },
      {
        title: 'Configure AI Features',
        description: 'Choose which AI features to enable and set spending limits.',
        steps: [
          'Go to Settings → AI Features',
          'Toggle the master "Enable AI" switch ON',
          'Enable/disable individual features:',
          '  — AI Chat Widget: Floating assistant on every page',
          '  — Command Bar (Ctrl+K): Quick natural-language commands',
          '  — Auto Reminders: AI-triggered appointment reminders',
          '  — Morning Briefing: Daily summary for clinic admins',
          '  — Patient Risk Scoring: Automatic risk assessment',
          'Set your Model Preference: Economy (cheapest), Balanced, or Quality',
          'Set your Monthly AI Budget limit (e.g., ₹500)',
          'Click "Save Settings"',
        ],
        tips: [
          'Start with Economy model — it handles most tasks well',
          'The chat widget can answer questions about patients, appointments, and billing',
          'Use Ctrl+K command bar for quick actions like "schedule appointment for Rahul tomorrow"',
        ],
        link: { label: 'Go to AI Settings', href: '/settings/ai' },
      },
    ],
  },
  {
    id: 'devices',
    title: 'IoT Devices',
    description: 'Connect dental chairs, sensors, and other IoT devices',
    icon: Cpu,
    color: 'text-slate-600 bg-slate-50',
    priority: 'optional',
    estimatedTime: '10 min per device',
    guides: [
      {
        title: 'Register a New Device',
        description: 'Add IoT-enabled dental equipment like chairs, sensors, or monitors to the system.',
        steps: [
          'Go to Devices from the sidebar (under Operations)',
          'Click "+ Register Device"',
          'Enter the Device Name (e.g., "Chair 1 — Room 2")',
          'Select the Device Type (e.g., Dental Chair, Sensor, Monitor)',
          'Enter the Device Serial Number (found on the device or its documentation)',
          'Enter the Device API Key or Connection Token (provided by the device manufacturer)',
          'Click "Register"',
          'The device will appear in the dashboard with a "Pending" status until it sends its first data',
        ],
        tips: [
          'Each device needs an API key to send data to DentalERP',
          'Contact your device manufacturer for integration documentation',
          'Device data is stored securely and can be viewed in real-time from the dashboard',
          'You can deactivate a device without deleting its historical data',
        ],
        link: { label: 'Go to Devices', href: '/devices' },
      },
    ],
  },
  {
    id: 'video',
    title: 'Video Consultations (Tele-Dentistry)',
    description: 'Enable online video appointments with patients',
    icon: Video,
    color: 'text-rose-600 bg-rose-50',
    priority: 'optional',
    estimatedTime: '2 min',
    guides: [
      {
        title: 'Enable Video Consultations',
        description: 'Allow patients to have video appointments with doctors from home.',
        steps: [
          'Video consultations work out of the box with no external setup needed',
          'Go to Appointments and create a new appointment',
          'Set the appointment Type to "VIDEO" or "TELEDENTISTRY"',
          'A unique video link will be generated automatically',
          'The patient receives the video link via SMS/Email (if configured)',
          'At the appointment time, both doctor and patient click the link to join',
          'Go to Video Consults in the sidebar to manage all video appointments',
        ],
        tips: [
          'Video calls use peer-to-peer technology (WebRTC) — no additional software needed',
          'Both doctor and patient need a device with a camera and microphone',
          'A stable internet connection (at least 2 Mbps) is recommended',
          'Doctors can take notes during the video call just like in-person appointments',
        ],
        link: { label: 'Go to Video Consults', href: '/video' },
      },
    ],
  },
  {
    id: 'security',
    title: 'Security Settings',
    description: 'Configure password policies, session timeouts, and two-factor authentication',
    icon: Shield,
    color: 'text-teal-600 bg-teal-50',
    priority: 'recommended',
    estimatedTime: '5 min',
    guides: [
      {
        title: 'Configure Security Policies',
        description: 'Set password strength rules, auto-logout timers, and enable 2FA for extra security.',
        steps: [
          'Go to Settings → Security Settings',
          'Set "Minimum Password Length" (recommended: 8 or more characters)',
          'Enable password complexity requirements (uppercase, lowercase, numbers, special characters)',
          'Set "Session Timeout" — users are auto-logged out after this many minutes of inactivity (recommended: 30-60 min)',
          'Set "Maximum Login Attempts" (recommended: 5) — locks account after too many failed attempts',
          'Set "Lockout Duration" (recommended: 30 minutes)',
          'Toggle "Require Two-Factor Authentication" ON for extra security (recommended for admin accounts)',
          'Click "Save Settings"',
        ],
        tips: [
          'Security changes take effect immediately for all users',
          'If you enable stricter password requirements, existing users will be asked to update their passwords',
          'Two-factor authentication (2FA) adds an extra step using a phone app like Google Authenticator',
          'Set IP restrictions only if your clinic has a fixed IP address — otherwise you might lock yourself out',
        ],
        link: { label: 'Go to Security Settings', href: '/settings/security' },
      },
    ],
  },
  {
    id: 'data-import',
    title: 'Import Data from Old System',
    description: 'Migrate patient records, appointments, and billing data from your previous software',
    icon: Upload,
    color: 'text-emerald-600 bg-emerald-50',
    priority: 'optional',
    estimatedTime: '20-60 min',
    guides: [
      {
        title: 'Import Data from CSV/Excel',
        description: 'Upload your old data files and let AI help map columns to the right fields.',
        steps: [
          'Export your data from your old software as CSV or Excel (.xlsx) files',
          'Go to Settings → Data Import',
          'Step 1: Select what you\'re importing (Patients, Appointments, Treatments, etc.)',
          'Upload your CSV/Excel file (max 20MB)',
          'Step 2: AI will automatically suggest column mappings (e.g., "Full Name" → First Name + Last Name)',
          'Review the mappings — adjust any that don\'t look right using the dropdown menus',
          'Step 3: Preview the transformed data — click any cell to edit if needed',
          'Step 4: Validate — the system checks for errors (missing required fields, duplicate records, etc.)',
          'Fix any errors by going back, or check "Skip Error Rows" to import only valid data',
          'Step 5: Confirm — review the summary and click "Confirm Import"',
          'Wait for import to complete — you\'ll see a success count and any error details',
        ],
        tips: [
          'Always back up your data before importing',
          'Start with a small file (10-20 rows) to test the process before importing everything',
          'The system supports: Patients, Staff, Appointments, Treatments, Invoices, Payments, and Inventory',
          'Phone numbers should be 10-digit Indian mobile numbers',
          'Date formats accepted: DD/MM/YYYY (preferred) and MM/DD/YYYY',
          'If importing staff, temporary passwords will be created — share them with each staff member',
        ],
        link: { label: 'Go to Data Import', href: '/settings/import' },
      },
    ],
  },
]

function PriorityBadge({ priority }: { priority: string }) {
  const styles = {
    essential: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    recommended: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    optional: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  }
  return (
    <Badge className={styles[priority as keyof typeof styles] || styles.optional} variant="secondary">
      {priority === 'essential' ? 'Essential' : priority === 'recommended' ? 'Recommended' : 'Optional'}
    </Badge>
  )
}

function GuideSection({ guide, index }: { guide: SetupStep; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{guide.title}</p>
          <p className="text-xs text-muted-foreground truncate">{guide.description}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t bg-accent/20">
          <div className="mt-3 space-y-4">
            {/* Steps */}
            <div>
              <p className="text-sm font-medium mb-2">Steps:</p>
              <ol className="space-y-1.5 ml-1">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground shrink-0 w-5 text-right">{step.startsWith('  ') ? '' : `${i + 1}.`}</span>
                    <span className={step.startsWith('  ') ? 'ml-5' : ''}>{step.replace(/^\s+/, '')}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            {guide.tips && guide.tips.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1.5">Tips:</p>
                <ul className="space-y-1">
                  {guide.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-500 flex gap-1.5">
                      <span className="shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2 pt-1">
              {guide.link && (
                <Link href={guide.link.href}>
                  <Button size="sm" variant="default">
                    {guide.link.label}
                    <ArrowLeft className="w-3 h-3 ml-1 rotate-180" />
                  </Button>
                </Link>
              )}
              {guide.externalLinks?.map((extLink, i) => (
                <a key={i} href={extLink.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    {extLink.label}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SetupGuidePage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['clinic']))
  const [filter, setFilter] = useState<'all' | 'essential' | 'recommended' | 'optional'>('all')

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setExpandedSections(new Set(setupSections.map((s) => s.id)))
  const collapseAll = () => setExpandedSections(new Set())

  const filteredSections = filter === 'all'
    ? setupSections
    : setupSections.filter((s) => s.priority === filter)

  const essentialCount = setupSections.filter((s) => s.priority === 'essential').length
  const recommendedCount = setupSections.filter((s) => s.priority === 'recommended').length
  const optionalCount = setupSections.filter((s) => s.priority === 'optional').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              Settings
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BookOpen className="w-7 h-7" />
          Setup Guide
        </h1>
        <p className="text-muted-foreground mt-1">
          Step-by-step instructions to set up your clinic. Follow the essential steps first, then add optional integrations.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${filter === 'essential' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilter(filter === 'essential' ? 'all' : 'essential')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{essentialCount}</p>
                <p className="text-xs text-muted-foreground">Essential Steps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${filter === 'recommended' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilter(filter === 'recommended' ? 'all' : 'recommended')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Circle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recommendedCount}</p>
                <p className="text-xs text-muted-foreground">Recommended</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${filter === 'optional' ? 'ring-2 ring-neutral-500' : ''}`}
          onClick={() => setFilter(filter === 'optional' ? 'all' : 'optional')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Circle className="w-5 h-5 text-neutral-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optionalCount}</p>
                <p className="text-xs text-muted-foreground">Optional</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
        {filter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
            Clear Filter
          </Button>
        )}
      </div>

      {/* Setup Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const Icon = section.icon
          const isExpanded = expandedSections.has(section.id)

          return (
            <Card key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full text-left"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${section.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <PriorityBadge priority={section.priority} />
                        <span className="text-xs text-muted-foreground">~{section.estimatedTime}</span>
                      </div>
                      <CardDescription className="text-sm">{section.description}</CardDescription>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3 mt-2">
                    {section.guides.map((guide, i) => (
                      <GuideSection key={i} guide={guide} index={i} />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Help Footer */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="font-semibold mb-1">Need More Help?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              If you&apos;re stuck on any step, feel free to use the AI Chat Assistant (bottom-right corner)
              for instant help, or contact our support team.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/chat">
                <Button variant="default" size="sm">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Ask AI Assistant
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
