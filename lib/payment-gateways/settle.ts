import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/**
 * Next sequential payment number for a hospital (PAY00001, PAY00002, …).
 * Runs inside the caller's transaction so reservation and settlement are atomic.
 */
async function nextPaymentNo(tx: Tx, hospitalId: string): Promise<string> {
  const last = await tx.payment.findFirst({
    where: { hospitalId },
    orderBy: { createdAt: 'desc' },
    select: { paymentNo: true },
  })
  const lastNum = last ? parseInt(last.paymentNo.replace(/\D/g, '')) || 0 : 0
  return `PAY${String(lastNum + 1).padStart(5, '0')}`
}

/**
 * Reserve a PENDING payment row when a gateway order is created, keyed by
 * gatewayOrderId. This is the record the webhook needs: without it, a payment
 * whose browser tab closed before the client-side verify call can never be
 * mapped back to its hospital and invoice, so the money is captured by the
 * gateway while the invoice stays unpaid.
 *
 * Does NOT touch the invoice — the invoice is only updated on settlement.
 * Idempotent: a second call for the same order is a no-op.
 */
export async function reservePendingPayment(input: {
  hospitalId: string
  invoiceId: string
  gatewayOrderId: string
  amount: number
  provider: string
  notes?: string
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { hospitalId: input.hospitalId, gatewayOrderId: input.gatewayOrderId },
      select: { id: true },
    })
    if (existing) return

    const paymentNo = await nextPaymentNo(tx, input.hospitalId)
    await tx.payment.create({
      data: {
        hospitalId: input.hospitalId,
        paymentNo,
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentMethod: 'ONLINE',
        status: 'PENDING',
        gateway: input.provider.toLowerCase(),
        gatewayOrderId: input.gatewayOrderId,
        notes: input.notes ?? `Online payment initiated via ${input.provider}`,
      },
    })
  })
}

export interface SettleResult {
  outcome: 'settled' | 'already_processed'
  paymentId: string
  paymentNo: string
  amount: number
}

/**
 * Record a completed online payment and apply it to its invoice, idempotently.
 *
 * Safe to call from the client-side verify flow AND the gateway webhook for the
 * same order: whichever arrives first settles it; the second returns
 * `already_processed` without double-counting against the invoice. When a
 * PENDING row was reserved at order-creation time it is settled in place;
 * otherwise a COMPLETED row is created (covers orders that predate reservation).
 */
export async function settlePayment(input: {
  hospitalId: string
  invoiceId: string
  gatewayOrderId: string
  provider: string
  amount?: number
  gatewayPaymentId?: string | null
  transactionId?: string | null
  gatewayStatus?: string | null
  notes?: string
}): Promise<SettleResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { hospitalId: input.hospitalId, gatewayOrderId: input.gatewayOrderId },
    })

    if (existing && existing.status === 'COMPLETED') {
      return {
        outcome: 'already_processed',
        paymentId: existing.id,
        paymentNo: existing.paymentNo,
        amount: Number(existing.amount),
      }
    }

    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, hospitalId: input.hospitalId },
    })
    if (!invoice) {
      throw new Error('Invoice not found')
    }

    // Prefer the explicit (gateway-reported) amount, then the amount reserved at
    // order time, then the full outstanding balance.
    const amount =
      input.amount ?? (existing ? Number(existing.amount) : Number(invoice.balanceAmount))
    const newPaidAmount = Number(invoice.paidAmount) + amount
    const newBalance = Number(invoice.totalAmount) - newPaidAmount

    const settledFields = {
      status: 'COMPLETED' as const,
      amount,
      paymentDate: new Date(),
      gateway: input.provider.toLowerCase(),
      gatewayPaymentId: input.gatewayPaymentId ?? undefined,
      transactionId: input.transactionId ?? undefined,
      gatewayStatus: input.gatewayStatus ?? undefined,
    }

    const payment = existing
      ? await tx.payment.update({
          where: { id: existing.id },
          data: { ...settledFields, ...(input.notes ? { notes: input.notes } : {}) },
        })
      : await tx.payment.create({
          data: {
            hospitalId: input.hospitalId,
            paymentNo: await nextPaymentNo(tx, input.hospitalId),
            invoiceId: input.invoiceId,
            paymentMethod: 'ONLINE',
            gatewayOrderId: input.gatewayOrderId,
            notes: input.notes ?? `Online payment via ${input.provider}`,
            ...settledFields,
          },
        })

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalance),
        status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      },
    })

    return {
      outcome: 'settled',
      paymentId: payment.id,
      paymentNo: payment.paymentNo,
      amount,
    }
  })
}
