'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle, Edit, Eye, Send, Trash2, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { insuranceClaimStatusConfig } from '@/lib/billing-utils'

interface Claim {
  id: string
  claimNumber: string
  status: string
  insuranceProvider: string
  policyNumber: string
  claimAmount: string | number
  approvedAmount: string | number | null
  settledAmount: string | number | null
  submittedDate: string | null
  approvedDate: string | null
  settledDate: string | null
  createdAt: string
  rejectionReason: string | null
  denialCode: string | null
  appealStatus: string | null
  appealDeadline: string | null
  appealNotes: string | null
  notes: string | null
  patient: { id: string; patientId: string; firstName: string; lastName: string; phone: string }
  invoices: {
    id: string
    invoiceNo: string
    createdAt: string
    totalAmount: string | number
    status: string
  }[]
}

type Decision = 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'

export default function InsuranceClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('billing.claimDetail')
  const tStatus = useTranslations('billing.claimStatus')
  const tInvoiceStatus = useTranslations('billing.status')
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })

  const [claim, setClaim] = useState<Claim | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  // The insurer's decision, and the settlement.
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decision, setDecision] = useState<Decision>('APPROVED')
  const [approvedAmount, setApprovedAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [settleOpen, setSettleOpen] = useState(false)
  const [settledAmount, setSettledAmount] = useState('')
  const [dialogError, setDialogError] = useState('')

  const load = useCallback(() => {
    fetch(`/api/insurance-claims/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.id) setNotFound(true)
        else setClaim(data)
      })
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(load, [load])

  async function update(body: Record<string, unknown>, success: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/insurance-claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast({ title: success })
      setDecisionOpen(false)
      setSettleOpen(false)
      load()
      return true
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('updateFailed')
      setDialogError(message)
      toast({ title: message, variant: 'destructive' })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: t('deleteTitle'),
      description: t('deleteDesc', { number: claim?.claimNumber ?? '' }),
      confirmLabel: t('delete'),
    })
    if (!ok) return
    const res = await fetch(`/api/insurance-claims/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: t('deleted') })
      router.push('/billing/insurance')
    } else {
      toast({ title: t('updateFailed'), variant: 'destructive' })
    }
  }

  function openDecision() {
    setDecision('APPROVED')
    setApprovedAmount(String(Number(claim?.claimAmount ?? 0)))
    setRejectionReason('')
    setDialogError('')
    setDecisionOpen(true)
  }

  function recordDecision() {
    if (!claim) return
    if (decision === 'REJECTED') {
      if (!rejectionReason.trim()) return setDialogError(t('errReason'))
      return update(
        { status: 'REJECTED', rejectionReason: rejectionReason.trim() },
        t('decisionRecorded')
      )
    }
    const amount = Number(approvedAmount)
    const max = Number(claim.claimAmount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
      return setDialogError(t('errApproved', { amount: formatCurrency(max) }))
    }
    if (decision === 'PARTIALLY_APPROVED' && amount === max) {
      return setDialogError(t('errPartial'))
    }
    return update({ status: decision, approvedAmount: amount }, t('decisionRecorded'))
  }

  function openSettle() {
    setSettledAmount(String(Number(claim?.approvedAmount ?? claim?.claimAmount ?? 0)))
    setDialogError('')
    setSettleOpen(true)
  }

  function recordSettlement() {
    const amount = Number(settledAmount)
    if (!Number.isFinite(amount) || amount <= 0) return setDialogError(t('errSettled'))
    return update({ status: 'SETTLED', settledAmount: amount }, t('settlementRecorded'))
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <p className="text-muted-foreground">{t('notFound')}</p>
          <Button asChild variant="outline">
            <Link href="/billing/insurance">{t('backToClaims')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!claim) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  const status = insuranceClaimStatusConfig[
    claim.status as keyof typeof insuranceClaimStatusConfig
  ] ?? { color: 'text-muted-foreground', bgColor: 'bg-muted' }
  const date = (value: string | null) => (value ? formatDate(value) : '-')
  const money = (value: string | number | null) => (value == null ? '-' : formatCurrency(value))
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
  const denied = Boolean(
    claim.rejectionReason || claim.denialCode || claim.appealStatus || claim.appealNotes
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
            {claim.claimNumber}
            <Badge className={`${status.bgColor} ${status.color} border-0`}>
              {tStatus.has(claim.status) ? tStatus(claim.status) : claim.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            {claim.insuranceProvider} · {claim.policyNumber}
          </p>
        </div>
        <div className="page-actions">
          {claim.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={remove} disabled={busy}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('delete')}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/billing/insurance/${claim.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t('edit')}
                </Link>
              </Button>
              <Button
                onClick={() => update({ status: 'SUBMITTED' }, t('submitted'))}
                disabled={busy}
              >
                <Send className="mr-2 h-4 w-4" />
                {t('submit')}
              </Button>
            </>
          )}
          {claim.status === 'SUBMITTED' && (
            <Button
              variant="outline"
              onClick={() => update({ status: 'UNDER_REVIEW' }, t('markedUnderReview'))}
              disabled={busy}
            >
              <Eye className="mr-2 h-4 w-4" />
              {t('markUnderReview')}
            </Button>
          )}
          {(claim.status === 'SUBMITTED' || claim.status === 'UNDER_REVIEW') && (
            <Button onClick={openDecision} disabled={busy}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('recordDecision')}
            </Button>
          )}
          {(claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED') && (
            <Button onClick={openSettle} disabled={busy}>
              <Wallet className="mr-2 h-4 w-4" />
              {t('recordSettlement')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('patient')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link
              href={`/patients/${claim.patient.id}`}
              className="font-medium text-primary hover:underline"
            >
              {claim.patient.firstName} {claim.patient.lastName}
            </Link>
            <p className="text-muted-foreground">{claim.patient.patientId}</p>
            <p className="text-muted-foreground">{claim.patient.phone}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('amounts')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row(t('claimed'), money(claim.claimAmount))}
            {row(t('approved'), money(claim.approvedAmount))}
            {row(t('settled'), money(claim.settledAmount))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dates')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row(t('created'), date(claim.createdAt))}
            {row(t('submittedOn'), claim.status === 'DRAFT' ? '-' : date(claim.submittedDate))}
            {row(t('approvedOn'), date(claim.approvedDate))}
            {row(t('settledOn'), date(claim.settledDate))}
          </CardContent>
        </Card>
      </div>

      {denied && (
        <Card>
          <CardHeader>
            <CardTitle>{t('denial')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {claim.rejectionReason && row(t('rejectionReason'), claim.rejectionReason)}
            {claim.denialCode && row(t('denialCode'), claim.denialCode)}
            {claim.appealStatus && row(t('appealStatus'), claim.appealStatus)}
            {claim.appealDeadline && row(t('appealDeadline'), date(claim.appealDeadline))}
            {claim.appealNotes && (
              <p className="whitespace-pre-wrap py-2 text-sm">{claim.appealNotes}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('invoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {claim.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colInvoice')}</TableHead>
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead className="text-right">{t('colTotal')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claim.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/billing/invoices/${invoice.id}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.invoiceNo}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                    <TableCell>
                      {tInvoiceStatus.has(invoice.status)
                        ? tInvoiceStatus(invoice.status)
                        : invoice.status}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(invoice.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {claim.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{claim.notes}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('decisionTitle')}</DialogTitle>
            <DialogDescription>
              {t('decisionDesc', { amount: formatCurrency(claim.claimAmount) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('decision')}</Label>
              <Select value={decision} onValueChange={(v) => setDecision(v as Decision)}>
                <SelectTrigger aria-label={t('decision')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {tStatus(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {decision === 'REJECTED' ? (
              <div className="space-y-2">
                <Label htmlFor="claim-rejection">{t('rejectionReason')}</Label>
                <Textarea
                  id="claim-rejection"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="claim-approved">{t('approvedAmount')}</Label>
                <Input
                  id="claim-approved"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                />
              </div>
            )}
            {dialogError && (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button onClick={recordDecision} disabled={busy}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settleTitle')}</DialogTitle>
            <DialogDescription>
              {t('settleDesc', { amount: money(claim.approvedAmount ?? claim.claimAmount) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="claim-settled">{t('settledAmount')}</Label>
            <Input
              id="claim-settled"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={settledAmount}
              onChange={(e) => setSettledAmount(e.target.value)}
            />
            {dialogError && (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button onClick={recordSettlement} disabled={busy}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialogComponent}
    </div>
  )
}
