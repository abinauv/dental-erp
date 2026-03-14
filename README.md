# DentalERP - Free Open Source Dental Clinic Management Software for India

A comprehensive, AI-powered **dental hospital management system** built with Next.js 16, designed for **dental clinics and multi-branch hospital chains in India**. Includes GST-compliant billing, Razorpay/PhonePe/Paytm payments, patient portal, tele-dentistry, 16 AI skills, and more — completely **free and open source**.

> **Looking for dental practice management software in India?** DentalERP is a free alternative to expensive proprietary dental software. Self-host it on your own server with full control over your patient data.

## Features

### Core Modules
- **Patient Management** — Records, medical history, dental charting, document uploads
- **Appointment Scheduling** — Calendar view, slot management, reminders, no-show prediction
- **Treatment Plans** — Treatment tracking, procedure catalog, AI-assisted treatment advice
- **Billing & Invoicing** — GST-compliant invoicing, payment tracking, payment plans (EMI)
- **Prescriptions** — Digital prescriptions, medication database, print/PDF export
- **Inventory Management** — Stock tracking, low-stock alerts, AI-powered demand forecasting
- **Lab Integration** — Lab order management, status tracking, work coordination
- **Staff Management** — Roles & permissions, attendance, doctor schedules

### Advanced Features
- **AI Skills (16 built-in)** — Treatment advisor, smart scheduler, billing agent, patient intake, inventory forecaster, cashflow forecaster, patient segmentation, claim analyzer, consent generator, dynamic pricing, and more
- **Patient Portal** — Online booking, medical records access, digital intake forms
- **Insurance & Claims** — Insurance verification, claim submission, auto-adjudication
- **CRM & Loyalty** — Patient segmentation, loyalty points, referral tracking
- **Communications** — SMS/Email/WhatsApp messaging, campaign management, marketing automation
- **Tele-Dentistry** — Video consultations via Jitsi Meet integration
- **Sterilization Tracking** — Instrument management, sterilization logs, compliance reporting
- **Dental Imaging** — Interactive SVG dental arch viewer with condition mapping
- **IoT Device Integration** — Medical device data logging and monitoring
- **Payment Gateways** — Razorpay, PhonePe, Paytm integration (encrypted credentials)
- **Reports & Analytics** — Revenue, appointments, treatment stats, exportable to Excel
- **Audit Logging** — Full audit trail for compliance
- **Multi-branch Support** — Hospital-scoped data isolation via NextAuth

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Database | [MySQL 8](https://www.mysql.com/) via [Prisma 5](https://www.prisma.io/) ORM |
| Auth | [NextAuth v5](https://authjs.dev/) (beta) with credentials provider |
| UI | [Tailwind CSS 3](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) validation |
| AI | [OpenRouter](https://openrouter.ai/) (multi-model gateway) |
| Email | Nodemailer (SMTP) |
| Testing | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) + [Testing Library](https://testing-library.com/) |
| CI/CD | GitHub Actions |

## Prerequisites

- **Node.js** 20 or later
- **MySQL** 8.0 or later
- **npm** 10 or later

## Getting Started

### Prerequisites Check

Make sure MySQL is running before you start:

```bash
# Verify MySQL is accessible
mysql -u root -p -e "SELECT 1"

# Create the database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS dental_erp"
```

### 1. Clone the repository

```bash
git clone https://github.com/abinauv/dental-erp.git
cd dental-erp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and other settings. See [Environment Variables](#environment-variables) for details.

### 4. Set up the database

```bash
# Push the schema to your MySQL database
npx prisma db push

# Seed with sample data (optional)
npx prisma db seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@demo-dental.com` | `Admin@123` |

> **Warning**: Change the default password immediately in production.

## Environment Variables

See [`.env.example`](.env.example) for all available variables. Key ones:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `NEXTAUTH_URL` | Yes | App URL (e.g., `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `ENCRYPTION_KEY` | Yes | 64-char hex string for AES-256-GCM encryption |
| `CRON_SECRET` | Yes | Secret for securing cron job endpoints |
| `OPENROUTER_API_KEY` | No | Required for AI features |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | No | Required for email features |
| `SMS_API_KEY` | No | Required for SMS features |

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run unit/integration tests (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:e2e     # Run end-to-end tests (Playwright)
npm run test:all     # Run all tests

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations (development)
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (DB GUI)
```

## Project Structure

```
dental-erp/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Authentication pages (login, signup, etc.)
│   ├── (dashboard)/        # Dashboard pages (all modules)
│   └── api/                # API routes
├── components/             # Reusable React components
│   ├── layout/             # Dashboard shell, sidebar, header
│   ├── ui/                 # shadcn/ui components
│   └── imaging/            # Dental imaging components
├── config/                 # App configuration (navigation, etc.)
├── lib/                    # Utilities, helpers, AI skills
│   ├── ai/                 # AI skill definitions
│   ├── api-helpers.ts      # Auth & API utilities
│   └── prisma.ts           # Prisma client singleton
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Database seeder
├── __tests__/              # Test files
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests (API routes)
│   ├── components/         # Component tests
│   ├── e2e/                # Playwright E2E tests
│   └── accessibility/      # Accessibility tests
├── .github/
│   └── workflows/ci.yml    # CI pipeline
└── public/                 # Static assets
```

## Testing

The project has comprehensive test coverage:

- **Unit tests** — Business logic, utilities, AI skills
- **Integration tests** — API route handlers with mocked Prisma
- **Component tests** — React components with Testing Library
- **E2E tests** — Full user flows with Playwright
- **Accessibility tests** — WCAG 2.1 compliance with axe-core

```bash
# Run all unit/integration tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests (requires running server)
npm run test:e2e
```

## Deployment

### Docker (recommended)

```bash
docker build -t dental-erp .
docker run -p 3000:3000 --env-file .env dental-erp
```

### Manual

```bash
npm run build
npm start
```

### Environment Requirements

- Node.js 20+
- MySQL 8.0+ (with a dedicated database)
- Reverse proxy (nginx/Caddy) for HTTPS in production

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md). Do **not** open a public issue for security vulnerabilities.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) by Vercel
- [Prisma](https://www.prisma.io/) for database ORM
- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [Radix UI](https://www.radix-ui.com/) for accessible primitives
- [OpenRouter](https://openrouter.ai/) for AI model access
