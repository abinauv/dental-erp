import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'DentalERP - Open Source Dental Hospital Management Software India',
    template: '%s | DentalERP',
  },
  description:
    'Free open-source dental clinic management software for India. Patient records, appointment scheduling, GST billing, inventory, AI-powered treatment planning, insurance claims, tele-dentistry. Built for Indian dental hospitals and clinics.',
  keywords: [
    'dental software India',
    'dental clinic management software',
    'dental hospital management system',
    'dental ERP',
    'dental practice management',
    'open source dental software',
    'free dental software India',
    'dental billing software GST',
    'patient management system dental',
    'appointment scheduling dental',
    'dental clinic software free',
    'hospital management system India',
    'HMS India',
    'dental records software',
    'AI dental software',
    'tele-dentistry India',
    'dental inventory management',
    'dental insurance claims India',
    'dental lab management',
    'multi-branch dental software',
  ],
  authors: [{ name: 'Abinauv Selvaraj' }],
  creator: 'Abinauv Selvaraj',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    title: 'DentalERP - Open Source Dental Hospital Management Software',
    description:
      'Free, AI-powered dental clinic management system built for Indian dental hospitals. Patient records, GST billing, appointments, inventory, insurance, tele-dentistry and more.',
    siteName: 'DentalERP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DentalERP - Open Source Dental Hospital Management Software',
    description:
      'Free, AI-powered dental clinic management system for India. 16 AI skills, GST billing, patient portal, tele-dentistry.',
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DentalERP',
  },
}

export const viewport: Viewport = {
  themeColor: '#0891B2',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale and messages come from the request config (lib/i18n/request.ts), which
  // resolves the clinic/user/patient cascade. Passing them to the client provider
  // is what lets client components use useTranslations.
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
