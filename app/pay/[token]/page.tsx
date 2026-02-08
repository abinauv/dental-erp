import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PayPage } from "./pay-page"

export default async function PublicPayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Look up the payment link
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNo: true,
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          status: true,
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      },
      hospital: {
        select: {
          name: true,
          logo: true,
          phone: true,
          email: true,
          address: true,
          city: true,
          state: true,
        },
      },
    },
  })

  if (!link) {
    notFound()
  }

  // Check if expired
  const isExpired = new Date() > new Date(link.expiresAt)
  // Check if already used
  const isUsed = !!link.usedAt
  // Check if invoice is already paid
  const isPaid = Number(link.invoice.balanceAmount) <= 0

  const amount = Number(link.amount)
  const currentBalance = Number(link.invoice.balanceAmount)
  // Use the lesser of link amount and current balance (in case partial payments were made)
  const payableAmount = Math.min(amount, currentBalance)

  return (
    <PayPage
      token={token}
      hospital={{
        name: link.hospital.name,
        logo: link.hospital.logo,
        phone: link.hospital.phone,
        email: link.hospital.email,
        address: link.hospital.address,
        city: link.hospital.city,
        state: link.hospital.state,
      }}
      invoice={{
        id: link.invoice.id,
        invoiceNo: link.invoice.invoiceNo,
        totalAmount: Number(link.invoice.totalAmount),
        paidAmount: Number(link.invoice.paidAmount),
        balanceAmount: currentBalance,
      }}
      patient={{
        name: `${link.invoice.patient.firstName} ${link.invoice.patient.lastName}`,
        phone: link.invoice.patient.phone,
      }}
      amount={payableAmount}
      isExpired={isExpired}
      isUsed={isUsed}
      isPaid={isPaid}
    />
  )
}
