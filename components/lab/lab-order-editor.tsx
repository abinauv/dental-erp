'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Search, User, FlaskConical, Save, Loader2 } from 'lucide-react'

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
}

interface LabVendor {
  id: string
  name: string
  phone: string
  contactPerson: string | null
  specializations: string | null
  avgTurnaround: number | null
}

// The LabWorkType enum, labelled by lab.workType.
const WORK_TYPES = [
  'CROWN',
  'BRIDGE',
  'DENTURE',
  'PARTIAL_DENTURE',
  'IMPLANT_CROWN',
  'VENEER',
  'INLAY_ONLAY',
  'NIGHT_GUARD',
  'RETAINER',
  'ALIGNER',
  'MODEL',
  'OTHER',
] as const

// Fields the edit form doesn't show. The API's update resets any it isn't
// sent, so they go back as they were.
const KEPT_ON_EDIT = [
  'sentDate',
  'receivedDate',
  'deliveredDate',
  'actualCost',
  'qualityCheck',
  'qualityNotes',
  'priority',
  'specialInstructions',
] as const

const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : '')

/**
 * The lab order form: a new order (/lab/orders/new), or an existing one when
 * given its id (/lab/orders/[id]/edit).
 */
export function LabOrderEditor({ orderId }: { orderId?: string }) {
  const editing = Boolean(orderId)
  const router = useRouter()
  const t = useTranslations('lab.orderNew')
  const tEdit = useTranslations('lab.orderEdit')
  const tWorkType = useTranslations('lab.workType')
  const { currency } = useClinicFormatters()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId')
  const { toast } = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [vendors, setVendors] = useState<LabVendor[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [kept, setKept] = useState<Record<string, unknown>>({})
  const [loadError, setLoadError] = useState(false)

  const [form, setForm] = useState({
    patientId: preselectedPatientId || '',
    labVendorId: '',
    workType: '',
    description: '',
    toothNumbers: '',
    shadeGuide: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    estimatedCost: '',
    notes: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsRes, vendorsRes] = await Promise.all([
          fetch('/api/patients?limit=100'),
          fetch('/api/lab-vendors?status=active'),
        ])

        if (patientsRes.ok) {
          const data = await patientsRes.json()
          setPatients(data.patients || [])
          if (preselectedPatientId) {
            const patient = (data.patients || []).find(
              (p: Patient) => p.id === preselectedPatientId
            )
            if (patient) setSelectedPatient(patient)
          }
        }

        if (vendorsRes.ok) {
          const data = await vendorsRes.json()
          setVendors(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [preselectedPatientId])

  useEffect(() => {
    if (!orderId) return
    fetch(`/api/lab-orders/${orderId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.data) throw new Error()
        const order = json.data
        setForm({
          patientId: order.patientId,
          labVendorId: order.labVendorId,
          workType: order.workType,
          description: order.description ?? '',
          toothNumbers: order.toothNumbers ?? '',
          shadeGuide: order.shadeGuide ?? '',
          orderDate: dateOnly(order.orderDate),
          expectedDate: dateOnly(order.expectedDate),
          estimatedCost: order.estimatedCost == null ? '' : String(Number(order.estimatedCost)),
          notes: order.notes ?? '',
        })
        setSelectedPatient({
          id: order.patientId,
          patientId: order.patientCode,
          firstName: order.firstName,
          lastName: order.lastName,
          phone: order.patientPhone,
        })
        setKept(Object.fromEntries(KEPT_ON_EDIT.map((key) => [key, order[key] ?? null])))
      })
      .catch(() => setLoadError(true))
  }, [orderId])

  const filteredPatients = patients.filter((patient) => {
    const s = patientSearch.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(s) ||
      patient.lastName.toLowerCase().includes(s) ||
      patient.phone.includes(patientSearch) ||
      patient.patientId.toLowerCase().includes(s)
    )
  })

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId)
    setSelectedPatient(patient || null)
    setForm((prev) => ({ ...prev, patientId }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.patientId) {
      toast({ variant: 'destructive', title: t('error'), description: t('selectPatientError') })
      return
    }
    if (!form.labVendorId) {
      toast({ variant: 'destructive', title: t('error'), description: t('selectVendorError') })
      return
    }
    if (!form.workType) {
      toast({ variant: 'destructive', title: t('error'), description: t('selectWorkTypeError') })
      return
    }
    if (!form.orderDate) {
      toast({ variant: 'destructive', title: t('error'), description: t('orderDateError') })
      return
    }
    if (!form.estimatedCost) {
      toast({ variant: 'destructive', title: t('error'), description: t('costError') })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        patientId: form.patientId,
        labVendorId: form.labVendorId,
        workType: form.workType,
        description: form.description || undefined,
        toothNumbers: form.toothNumbers || undefined,
        shadeGuide: form.shadeGuide || undefined,
        orderDate: form.orderDate,
        expectedDate: form.expectedDate || undefined,
        estimatedCost: parseFloat(form.estimatedCost),
        notes: form.notes || undefined,
      }

      const response = await fetch(editing ? `/api/lab-orders/${orderId}` : '/api/lab-orders', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...kept, ...payload } : payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: t('unknownError') }))
        throw new Error(data.error || t('createFailedStatus', { status: response.status }))
      }

      if (editing) {
        toast({ title: tEdit('updated') })
        router.push(`/lab/orders/${orderId}`)
        return
      }

      const result = await response.json()

      toast({
        title: t('created'),
        description: t('createdDesc', { orderNumber: result.data.orderNumber }),
      })

      router.push('/lab')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('createFailed'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={editing ? `/lab/orders/${orderId}` : '/lab'}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{editing ? tEdit('title') : t('title')}</h1>
          <p className="text-muted-foreground">{editing ? tEdit('subtitle') : t('subtitle')}</p>
        </div>
      </div>

      {loadError && <p className="text-destructive">{tEdit('loadError')}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('patient')}
            </CardTitle>
            <CardDescription>{t('patientDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPatient.patientId} | {selectedPatient.phone}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedPatient(null)
                    setForm((prev) => ({ ...prev, patientId: '' }))
                  }}
                >
                  {t('change')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPatients')}
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">{t('noPatients')}</div>
                  ) : (
                    filteredPatients.slice(0, 10).map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handlePatientSelect(patient.id)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-muted/50 border-b last:border-b-0 text-left"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {patient.firstName} {patient.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {patient.patientId} | {patient.phone}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lab Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              {t('orderDetails')}
            </CardTitle>
            <CardDescription>{t('orderDetailsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('labVendor')}</Label>
                <Select
                  value={form.labVendorId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, labVendorId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVendor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.avgTurnaround
                          ? t('vendorTurnaround', {
                              name: vendor.name,
                              days: vendor.avgTurnaround,
                            })
                          : vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('workType')}</Label>
                <Select
                  value={form.workType}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, workType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectWorkType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map((wt) => (
                      <SelectItem key={wt} value={wt}>
                        {tWorkType(wt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('toothNumbers')}</Label>
                <Input
                  value={form.toothNumbers}
                  onChange={(e) => setForm((prev) => ({ ...prev, toothNumbers: e.target.value }))}
                  placeholder={t('toothPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('shadeGuide')}</Label>
                <Input
                  value={form.shadeGuide}
                  onChange={(e) => setForm((prev) => ({ ...prev, shadeGuide: e.target.value }))}
                  placeholder={t('shadePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates & Cost */}
        <Card>
          <CardHeader>
            <CardTitle>{t('scheduleCost')}</CardTitle>
            <CardDescription>{t('scheduleCostDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('orderDate')}</Label>
                <Input
                  type="date"
                  value={form.orderDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('expectedDate')}</Label>
                <Input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, expectedDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('estimatedCost', { currency })}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimatedCost: e.target.value }))}
                  placeholder={t('estimatedCostPlaceholder')}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('additionalNotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder={t('notesPlaceholder')}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href={editing ? `/lab/orders/${orderId}` : '/lab'}>
            <Button type="button" variant="outline">
              {t('cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editing ? tEdit('saving') : t('creating')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {editing ? tEdit('save') : t('createLabOrder')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
