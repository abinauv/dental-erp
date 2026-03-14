import { redirect } from "next/navigation"
import { getAuthenticatedPatient } from "@/lib/patient-auth"
import { prisma } from "@/lib/prisma"
import { PortalShell } from "@/components/portal/portal-shell"

export const metadata = {
  title: "Patient Portal",
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const patient = await getAuthenticatedPatient()

  if (!patient) {
    redirect("/portal/login")
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: patient.hospitalId },
    select: {
      name: true,
      logo: true,
      phone: true,
      email: true,
      slug: true,
    },
  })

  if (!hospital) {
    redirect("/portal/login")
  }

  return (
    <PortalShell
      patient={{
        name: `${patient.firstName} ${patient.lastName}`,
        patientId: patient.patientId,
        phone: patient.phone,
      }}
      hospital={{
        name: hospital.name,
        logo: hospital.logo,
        slug: hospital.slug,
      }}
    >
      {children}
    </PortalShell>
  )
}
