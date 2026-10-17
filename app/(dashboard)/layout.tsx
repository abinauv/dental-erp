import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { ClinicLocaleProvider } from '@/components/i18n/clinic-locale-provider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const hospitalId = session.user.hospitalId

  // Fetch hospital info
  const hospital = hospitalId
    ? await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: {
          name: true,
          plan: true,
          logo: true,
          currency: true,
          onboardingCompleted: true,
        },
      })
    : null

  // Redirect to onboarding if not complete (except if already on onboarding page)
  if (hospital && !hospital.onboardingCompleted) {
    redirect('/onboarding')
  }

  const user = {
    name: session.user.name || 'User',
    email: session.user.email || '',
    role: session.user.role || 'RECEPTIONIST',
  }

  const hospitalInfo = hospital
    ? {
        name: hospital.name,
        plan: hospital.plan,
        logo: hospital.logo,
      }
    : undefined

  return (
    <ClinicLocaleProvider currency={hospital?.currency || 'INR'}>
      <DashboardShell user={user} hospital={hospitalInfo}>
        {children}
      </DashboardShell>
    </ClinicLocaleProvider>
  )
}
