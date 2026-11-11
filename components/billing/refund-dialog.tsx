'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

export interface RefundablePayment {
  id: string
  paymentNo: string
  amount: string | number
}

interface RefundDialogProps {
  payment: RefundablePayment | null
  onOpenChange: (open: boolean) => void
  onRefunded: () => void
}

/**
 * Refunds a completed payment (POST /api/payments/[id]/refund). The amount
 * defaults to the whole payment and can't exceed it; the API takes it off the
 * invoice's paid total and marks the payment refunded.
 */
export function RefundDialog({ payment, onOpenChange, onRefunded }: RefundDialogProps) {
  return (
    <Dialog open={payment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Keyed so each payment starts from a fresh form. */}
        {payment && (
          <RefundForm
            key={payment.id}
            payment={payment}
            onClose={() => onOpenChange(false)}
            onRefunded={onRefunded}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RefundForm({
  payment,
  onClose,
  onRefunded,
}: {
  payment: RefundablePayment
  onClose: () => void
  onRefunded: () => void
}) {
  const t = useTranslations('billing.payments.refundDialog')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const { formatCurrency: fc } = useClinicFormatters()
  // Two decimals, as on the payments page.
  const formatCurrency = (amount: number) => fc(amount, { minimumFractionDigits: 2 })
  const max = Number(payment.amount)
  const [amount, setAmount] = useState(String(max))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > max) {
      setError(t('invalidAmount', { amount: formatCurrency(max) }))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmount: value, refundReason: reason.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || t('failed'))
        return
      }
      toast({ title: t('success') })
      onClose()
      onRefunded()
    } catch {
      setError(t('failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>
          {t('description', { number: payment.paymentNo, amount: formatCurrency(max) })}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="refund-amount">{t('amount')}</Label>
        <Input
          id="refund-amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          max={max}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t('maxAmount', { amount: formatCurrency(max) })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="refund-reason">{t('reason')}</Label>
        <Textarea
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
          rows={3}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          {tCommon('actions.cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
