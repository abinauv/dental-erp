'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  Play,
  CheckCircle,
  XCircle,
  Edit,
  Printer,
  AlertCircle,
  Pill,
  Receipt,
} from 'lucide-react'
import { VoiceInput } from '@/components/clinical/voice-input'
import {
  treatmentStatusConfig,
  procedureCategoryConfig,
  parseToothNumbers,
  toothNames,
} from '@/lib/treatment-utils'

interface Treatment {
  id: string
  treatmentNo: string
  chiefComplaint: string | null
  diagnosis: string | null
  findings: string | null
  procedureNotes: string | null
  materialsUsed: string | null
  complications: string | null
  toothNumbers: string | null
  status: string
  cost: string | number
  startTime: string | null
  endTime: string | null
  followUpRequired: boolean
  followUpDate: string | null
  createdAt: string
  updatedAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    dateOfBirth: string | null
    gender: string | null
    bloodGroup: string | null
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
    phone: string | null
  }
  procedure: {
    id: string
    code: string
    name: string
    category: string
    description: string | null
    defaultDuration: number
    basePrice: string | number
    preInstructions: string | null
    postInstructions: string | null
  }
  appointment: {
    id: string
    appointmentNo: string
    scheduledDate: string
    scheduledTime: string
    status: string
  } | null
  prescriptions: any[]
  invoiceItems: any[]
}

export default function TreatmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('treatments.detail')
  const tStatus = useTranslations('treatments.status')
  const tCategory = useTranslations('treatments.category')
  const fmt = useClinicFormatters()
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [loading, setLoading] = useState(true)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Complete form state
  const [completeFormData, setCompleteFormData] = useState({
    procedureNotes: '',
    materialsUsed: '',
    complications: '',
    followUpRequired: false,
    followUpDate: '',
  })

  const fetchTreatment = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/treatments/${id}`)
      if (!response.ok) throw new Error('Failed to fetch treatment')
      const data = await response.json()
      setTreatment(data)

      // Pre-fill complete form with existing data
      setCompleteFormData({
        procedureNotes: data.procedureNotes || '',
        materialsUsed: data.materialsUsed || '',
        complications: data.complications || '',
        followUpRequired: data.followUpRequired || false,
        followUpDate: data.followUpDate ? data.followUpDate.split('T')[0] : '',
      })
    } catch (error) {
      console.error('Error fetching treatment:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTreatment()
  }, [id])

  const handleStartTreatment = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatments/${id}/start`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to start treatment')
      fetchTreatment()
    } catch (error) {
      console.error('Error starting treatment:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteTreatment = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatments/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeFormData),
      })
      if (!response.ok) throw new Error('Failed to complete treatment')
      setCompleteDialogOpen(false)
      fetchTreatment()
    } catch (error) {
      console.error('Error completing treatment:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelTreatment = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!response.ok) throw new Error('Failed to cancel treatment')
      setCancelDialogOpen(false)
      fetchTreatment()
    } catch (error) {
      console.error('Error cancelling treatment:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = treatmentStatusConfig[status] || {
      label: status,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    }
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0 text-sm`}>{label}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!treatment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Link href="/treatments">
          <Button variant="outline">{t('backToTreatments')}</Button>
        </Link>
      </div>
    )
  }

  const teeth = treatment.toothNumbers ? parseToothNumbers(treatment.toothNumbers) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/treatments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{treatment.treatmentNo}</h1>
              {getStatusBadge(treatment.status)}
            </div>
            <p className="text-muted-foreground">
              {t('createdOn', { date: fmt.formatDate(treatment.createdAt) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {treatment.status === 'PLANNED' && (
            <Button onClick={handleStartTreatment} disabled={actionLoading}>
              <Play className="h-4 w-4 mr-2" />
              {t('startTreatment')}
            </Button>
          )}
          {treatment.status === 'IN_PROGRESS' && (
            <Button onClick={() => setCompleteDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('completeTreatment')}
            </Button>
          )}
          {treatment.status !== 'COMPLETED' && treatment.status !== 'CANCELLED' && (
            <>
              <Link href={`/treatments/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  {t('edit')}
                </Button>
              </Link>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => setCancelDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t('cancel')}
              </Button>
            </>
          )}
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            {t('print')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Procedure Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                {t('procedureDetails')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-lg">{treatment.procedure.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('code', { code: treatment.procedure.code })}
                  </div>
                </div>
                <Badge
                  className={`${procedureCategoryConfig[treatment.procedure.category]?.bgColor} ${procedureCategoryConfig[treatment.procedure.category]?.color} border-0`}
                >
                  {tCategory.has(treatment.procedure.category)
                    ? tCategory(treatment.procedure.category)
                    : procedureCategoryConfig[treatment.procedure.category]?.label}
                </Badge>
              </div>

              {treatment.procedure.description && (
                <p className="text-sm text-muted-foreground">{treatment.procedure.description}</p>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">{t('treatmentCost')}</div>
                  <div className="font-medium text-lg">{fmt.formatCurrency(treatment.cost)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('basePrice')}</div>
                  <div className="font-medium">
                    {fmt.formatCurrency(treatment.procedure.basePrice)}
                  </div>
                </div>
              </div>

              {treatment.startTime && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {t('started', { datetime: fmt.formatDateTime(treatment.startTime) })}
                    </span>
                  </div>
                  {treatment.endTime && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>
                        {t('completed', { datetime: fmt.formatDateTime(treatment.endTime) })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teeth Affected */}
          {teeth.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('teethAffected')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {teeth.map((tooth) => (
                    <div key={tooth} className="px-3 py-2 bg-muted rounded-lg text-sm">
                      <span className="font-medium">{tooth}</span>
                      <span className="text-muted-foreground ml-1">
                        - {toothNames[tooth]?.split(' ').slice(-2).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('clinicalNotes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {treatment.chiefComplaint && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('chiefComplaint')}
                  </div>
                  <p className="mt-1">{treatment.chiefComplaint}</p>
                </div>
              )}

              {treatment.diagnosis && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('diagnosis')}</div>
                  <p className="mt-1">{treatment.diagnosis}</p>
                </div>
              )}

              {treatment.findings && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('findings')}</div>
                  <p className="mt-1">{treatment.findings}</p>
                </div>
              )}

              {treatment.procedureNotes && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('procedureNotes')}
                  </div>
                  <p className="mt-1">{treatment.procedureNotes}</p>
                </div>
              )}

              {treatment.materialsUsed && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('materialsUsed')}
                  </div>
                  <p className="mt-1">{treatment.materialsUsed}</p>
                </div>
              )}

              {treatment.complications && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground text-amber-600">
                    {t('complications')}
                  </div>
                  <p className="mt-1">{treatment.complications}</p>
                </div>
              )}

              {!treatment.chiefComplaint &&
                !treatment.diagnosis &&
                !treatment.findings &&
                !treatment.procedureNotes && (
                  <p className="text-muted-foreground text-center py-4">{t('noNotes')}</p>
                )}
            </CardContent>
          </Card>

          {/* Pre/Post Instructions */}
          {(treatment.procedure.preInstructions || treatment.procedure.postInstructions) && (
            <Card>
              <CardHeader>
                <CardTitle>{t('instructions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {treatment.procedure.preInstructions && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('preInstructions')}
                    </div>
                    <p className="mt-1">{treatment.procedure.preInstructions}</p>
                  </div>
                )}
                {treatment.procedure.postInstructions && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('postInstructions')}
                    </div>
                    <p className="mt-1">{treatment.procedure.postInstructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('patient')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-medium">
                    {treatment.patient.firstName} {treatment.patient.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">{treatment.patient.patientId}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {treatment.patient.phone}
                </div>
                {treatment.patient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {treatment.patient.email}
                  </div>
                )}
                {treatment.patient.bloodGroup && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('bloodGroup')}</span>
                    <Badge variant="outline">{treatment.patient.bloodGroup}</Badge>
                  </div>
                )}
              </div>

              <Link href={`/patients/${treatment.patient.id}`}>
                <Button variant="outline" className="w-full">
                  {t('viewProfile')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Doctor Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                {t('doctor')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-medium">
                {t('doctorName', {
                  name: `${treatment.doctor.firstName} ${treatment.doctor.lastName}`,
                })}
              </div>
              {treatment.doctor.specialization && (
                <div className="text-sm text-muted-foreground">
                  {treatment.doctor.specialization}
                </div>
              )}
              {treatment.doctor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {treatment.doctor.phone}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointment Info */}
          {treatment.appointment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('appointment')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="font-medium">{treatment.appointment.appointmentNo}</div>
                <div className="text-sm text-muted-foreground">
                  {t('appointmentAt', {
                    date: fmt.formatDate(treatment.appointment.scheduledDate),
                    time: treatment.appointment.scheduledTime,
                  })}
                </div>
                <Link href={`/appointments/${treatment.appointment.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    {t('viewAppointment')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Follow-up */}
          {treatment.followUpRequired && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                  {t('followUpRequiredTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {treatment.followUpDate ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {fmt.formatDate(treatment.followUpDate)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('dateNotScheduled')}</p>
                )}
                <Button variant="outline" size="sm" className="w-full mt-4">
                  {t('scheduleFollowUp')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Prescriptions */}
          {treatment.prescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  {t('prescriptions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {t('prescriptionsIssued', { count: treatment.prescriptions.length })}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  {t('viewPrescriptions')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          {treatment.invoiceItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {t('billing')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {t('invoiceItems', { count: treatment.invoiceItems.length })}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  {t('viewInvoices')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Complete Treatment Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('completeTitle')}</DialogTitle>
            <DialogDescription>{t('completeDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="procedureNotes">{t('procedureNotes')}</Label>
                <VoiceInput
                  onTranscript={(text) =>
                    setCompleteFormData((prev) => ({
                      ...prev,
                      procedureNotes: prev.procedureNotes ? prev.procedureNotes + ' ' + text : text,
                    }))
                  }
                />
              </div>
              <Textarea
                id="procedureNotes"
                value={completeFormData.procedureNotes}
                onChange={(e) =>
                  setCompleteFormData({
                    ...completeFormData,
                    procedureNotes: e.target.value,
                  })
                }
                placeholder={t('procedureNotesPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialsUsed">{t('materialsUsed')}</Label>
              <Textarea
                id="materialsUsed"
                value={completeFormData.materialsUsed}
                onChange={(e) =>
                  setCompleteFormData({
                    ...completeFormData,
                    materialsUsed: e.target.value,
                  })
                }
                placeholder={t('materialsUsedPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complications">{t('complicationsLabel')}</Label>
              <Textarea
                id="complications"
                value={completeFormData.complications}
                onChange={(e) =>
                  setCompleteFormData({
                    ...completeFormData,
                    complications: e.target.value,
                  })
                }
                placeholder={t('complicationsPlaceholder')}
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="followUpRequired"
                checked={completeFormData.followUpRequired}
                onCheckedChange={(checked) =>
                  setCompleteFormData({
                    ...completeFormData,
                    followUpRequired: checked as boolean,
                  })
                }
              />
              <Label htmlFor="followUpRequired">{t('followUpRequired')}</Label>
            </div>

            {completeFormData.followUpRequired && (
              <div className="space-y-2">
                <Label htmlFor="followUpDate">{t('followUpDate')}</Label>
                <Input
                  id="followUpDate"
                  type="date"
                  value={completeFormData.followUpDate}
                  onChange={(e) =>
                    setCompleteFormData({
                      ...completeFormData,
                      followUpDate: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCompleteTreatment} disabled={actionLoading}>
              {actionLoading ? t('completing') : t('completeTreatment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Treatment Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
            <DialogDescription>{t('cancelDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              {t('keepTreatment')}
            </Button>
            <Button variant="destructive" onClick={handleCancelTreatment} disabled={actionLoading}>
              {actionLoading ? t('cancelling') : t('cancelTitle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
