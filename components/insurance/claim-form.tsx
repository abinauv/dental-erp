'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
}

interface Policy {
  id: string
  policyNumber: string
  isActive: boolean
  provider: { id: string; name: string }
}

interface ClaimInvoice {
  id: string
  invoiceNo: string
  createdAt: string
  totalAmount: string | number
  status: string
  insuranceClaimId?: string | null
}

/**
 * The insurance claim form: a new claim (/billing/insurance/new), or a draft
 * when given its id (/billing/insurance/[id]/edit). The update API changes the
 * insurer, policy number, amount and notes of a draft, not its patient or
 * linked invoices, so those are shown but fixed when editing.
 */
export function ClaimForm({ claimId }: { claimId?: string }) {
  const editing = Boolean(claimId)
  const router = useRouter()
  const t = useTranslations('billing.claimForm')
  const tInvoiceStatus = useTranslations('billing.status')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })

  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [patient, setPatient] = useState<Patient | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [invoices, setInvoices] = useState<ClaimInvoice[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  // So "no invoices" isn't shown while they're still loading.
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [claimAmount, setClaimAmount] = useState('')
  // Until the amount is typed, it follows the selected invoices' total.
  const [amountTouched, setAmountTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [claimNumber, setClaimNumber] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notEditable' | 'error'>(
    claimId ? 'loading' : 'ready'
  )

  // Load the draft when editing.
  useEffect(() => {
    if (!claimId) return
    fetch(`/api/insurance-claims/${claimId}`)
      .then(async (res) => {
        const claim = await res.json().catch(() => null)
        if (!res.ok || !claim?.id) throw new Error()
        setClaimNumber(claim.claimNumber)
        if (claim.status !== 'DRAFT') {
          setLoadState('notEditable')
          return
        }
        setPatient(claim.patient)
        setInsuranceProvider(claim.insuranceProvider)
        setPolicyNumber(claim.policyNumber)
        setClaimAmount(String(Number(claim.claimAmount)))
        setAmountTouched(true)
        setNotes(claim.notes ?? '')
        setInvoices(claim.invoices)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [claimId])

  // Patient search (new claims).
  useEffect(() => {
    if (editing || patientSearch.length < 2) return
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`)
      if (res.ok) setPatients((await res.json()).patients || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [patientSearch, editing])

  // The patient's policies, and (new claims) the invoices not yet claimed.
  useEffect(() => {
    if (!patient) return
    fetch(`/api/patients/${patient.id}/insurance`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) =>
        setPolicies(Array.isArray(data) ? data.filter((p: Policy) => p.isActive) : [])
      )
      .catch(() => setPolicies([]))
    if (editing) return
    fetch(`/api/invoices?patientId=${patient.id}&limit=100`)
      .then((res) => (res.ok ? res.json() : { invoices: [] }))
      .then((data) =>
        setInvoices(
          (data.invoices || []).filter(
            (invoice: ClaimInvoice) =>
              !invoice.insuranceClaimId && !['DRAFT', 'CANCELLED'].includes(invoice.status)
          )
        )
      )
      .catch(() => setInvoices([]))
      .finally(() => setInvoicesLoading(false))
  }, [patient, editing])

  const choosePatient = (chosen: Patient | null) => {
    setPatient(chosen)
    setInvoicesLoading(Boolean(chosen))
    setPatientSearch('')
    setPatients([])
    setPolicies([])
    setInvoices([])
    setSelectedInvoiceIds([])
    setInsuranceProvider('')
    setPolicyNumber('')
    if (!amountTouched) setClaimAmount('')
  }

  const applyPolicy = (policyId: string) => {
    const policy = policies.find((p) => p.id === policyId)
    if (policy) {
      setInsuranceProvider(policy.provider.name)
      setPolicyNumber(policy.policyNumber)
    }
  }

  const toggleInvoice = (invoice: ClaimInvoice, checked: boolean) => {
    const ids = checked
      ? [...selectedInvoiceIds, invoice.id]
      : selectedInvoiceIds.filter((id) => id !== invoice.id)
    setSelectedInvoiceIds(ids)
    if (!amountTouched) {
      const total = invoices
        .filter((i) => ids.includes(i.id))
        .reduce((sum, i) => sum + Number(i.totalAmount), 0)
      setClaimAmount(total ? String(total) : '')
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(claimAmount)
    if (!patient) return setError(t('errPatient'))
    if (!insuranceProvider.trim()) return setError(t('errProvider'))
    if (!policyNumber.trim()) return setError(t('errPolicy'))
    if (!Number.isFinite(amount) || amount <= 0) return setError(t('errAmount'))
    setError('')
    setSaving(true)
    try {
      const res = await fetch(
        editing ? `/api/insurance-claims/${claimId}` : '/api/insurance-claims',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(editing ? {} : { patientId: patient.id, invoiceIds: selectedInvoiceIds }),
            insuranceProvider: insuranceProvider.trim(),
            policyNumber: policyNumber.trim(),
            claimAmount: amount,
            notes,
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('saveFailed'))
      router.push(`/billing/insurance/${editing ? claimId : data.id}`)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('saveFailed'))
      setSaving(false)
    }
  }

  if (editing && loadState !== 'ready') {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          {loadState === 'loading'
            ? t('loading')
            : loadState === 'notEditable'
              ? t('notEditable', { number: claimNumber })
              : t('loadError')}
        </p>
        {loadState !== 'loading' && (
          <Link href={`/billing/insurance/${claimId}`}>
            <Button variant="outline">{t('backToClaim')}</Button>
          </Link>
        )}
      </div>
    )
  }

  const backHref = editing ? `/billing/insurance/${claimId}` : '/billing/insurance'

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button type="button" variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {editing ? t('titleEdit', { number: claimNumber }) : t('titleNew')}
          </h1>
          <p className="text-muted-foreground">{editing ? t('subtitleEdit') : t('subtitleNew')}</p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700"
        >
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('patient')}</CardTitle>
        </CardHeader>
        <CardContent>
          {patient ? (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div>
                <p className="font-medium">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{patient.patientId}</p>
              </div>
              {!editing && (
                <Button type="button" variant="ghost" size="sm" onClick={() => choosePatient(null)}>
                  {t('change')}
                </Button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder={t('searchPatients')}
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patientSearch.length >= 2 && patients.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => choosePatient(p)}
                    >
                      <span className="font-medium">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="ml-2 text-muted-foreground">{p.patientId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {patient && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('insurance')}</CardTitle>
              {policies.length === 0 && <CardDescription>{t('noPolicies')}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              {policies.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('policy')}</Label>
                  <Select onValueChange={applyPolicy}>
                    <SelectTrigger aria-label={t('policy')}>
                      <SelectValue placeholder={t('selectPolicy')} />
                    </SelectTrigger>
                    <SelectContent>
                      {policies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.provider.name} — {p.policyNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="claim-provider">{t('provider')}</Label>
                  <Input
                    id="claim-provider"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claim-policy">{t('policyNumber')}</Label>
                  <Input
                    id="claim-policy"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editing ? t('linkedInvoices') : t('invoices')}</CardTitle>
              <CardDescription>{editing ? t('linkedLocked') : t('invoicesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <p className="text-sm text-muted-foreground">{t('loadingInvoices')}</p>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!editing && <TableHead className="w-10" />}
                      <TableHead>{t('colInvoice')}</TableHead>
                      <TableHead>{t('colDate')}</TableHead>
                      <TableHead>{t('colStatus')}</TableHead>
                      <TableHead className="text-right">{t('colTotal')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        {!editing && (
                          <TableCell>
                            <Checkbox
                              aria-label={invoice.invoiceNo}
                              checked={selectedInvoiceIds.includes(invoice.id)}
                              onCheckedChange={(checked) =>
                                toggleInvoice(invoice, checked === true)
                              }
                            />
                          </TableCell>
                        )}
                        <TableCell>{invoice.invoiceNo}</TableCell>
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

          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="claim-amount">{t('amount')}</Label>
                <Input
                  id="claim-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={claimAmount}
                  onChange={(e) => {
                    setClaimAmount(e.target.value)
                    setAmountTouched(true)
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="claim-notes">{t('notes')}</Label>
                <Textarea
                  id="claim-notes"
                  rows={3}
                  value={notes}
                  placeholder={t('notesPlaceholder')}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end gap-3">
        <Link href={backHref}>
          <Button type="button" variant="outline">
            {t('cancel')}
          </Button>
        </Link>
        <Button type="submit" disabled={saving || !patient}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? (editing ? t('saving') : t('creating')) : editing ? t('save') : t('create')}
        </Button>
      </div>
    </form>
  )
}
