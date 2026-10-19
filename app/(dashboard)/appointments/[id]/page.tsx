'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  LogIn,
  LogOut,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Stethoscope,
  FileText,
  History,
  Video,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  appointmentStatusConfig,
  appointmentTypeConfig,
  priorityConfig,
  formatTime,
  getPatientName,
  getDoctorName,
} from '@/lib/appointment-utils'

interface Appointment {
  id: string
  appointmentNo: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  chairNumber: number | null
  appointmentType: string
  status: string
  priority: string
  chiefComplaint: string | null
  notes: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  waitTime: number | null
  cancelledAt: string | null
  cancellationReason: string | null
  isVirtual: boolean
  videoConsultationId: string | null
  createdAt: string
  updatedAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    address: string | null
    city: string | null
    medicalHistory: {
      hasAllergies: boolean
      drugAllergies: string | null
      hasDiabetes: boolean
      hasHypertension: boolean
      hasHeartDisease: boolean
      currentMedications: string | null
    } | null
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
    phone: string | null
  }
  treatments: Array<{
    id: string
    treatmentNo: string
    status: string
    procedure: {
      name: string
      code: string
    }
  }>
  reminders: Array<{
    id: string
    reminderType: string
    status: string
    scheduledFor: string
    sentAt: string | null
  }>
}

export default function AppointmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('appointments.detail')
  const tStatus = useTranslations('appointments.status')
  const tType = useTranslations('appointments.type')
  const tPriority = useTranslations('appointments.priority')
  const fmt = useClinicFormatters()
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')

  const fetchAppointment = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/appointments/${id}`)
      if (!response.ok) throw new Error('Failed to fetch appointment')
      const data = await response.json()
      setAppointment(data)
    } catch (error) {
      console.error('Error fetching appointment:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointment()
  }, [id])

  const handleCheckIn = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/appointments/${id}/check-in`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to check in')
      fetchAppointment()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/appointments/${id}/check-out`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to check out')
      fetchAppointment()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      setActionLoading(true)
      const body: any = { status }
      if (status === 'CANCELLED' && cancellationReason) {
        body.cancellationReason = cancellationReason
      }

      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Failed to update status')
      fetchAppointment()
      setShowCancelDialog(false)
      setCancellationReason('')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = appointmentStatusConfig[status] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 text-base px-3 py-1`}>
        {label}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const config = appointmentTypeConfig[type] || {
      label: type,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
    }
    const label = tType.has(type) ? tType(type) : config.label
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority] || {
      label: priority,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tPriority.has(priority) ? tPriority(priority) : config.label
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">{t('notFound')}</h2>
        <p className="text-muted-foreground mb-4">{t('notFoundDesc')}</p>
        <Link href="/appointments">
          <Button>{t('backToAppointments')}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/appointments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{appointment.appointmentNo}</h1>
              {getStatusBadge(appointment.status)}
              {appointment.isVirtual && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                  <Video className="h-3 w-3 mr-1" />
                  {t('virtual')}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {t('createdOn', { date: fmt.formatDate(appointment.createdAt) })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {appointment.isVirtual &&
            appointment.videoConsultationId &&
            ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) && (
              <Link href={`/video/${appointment.videoConsultationId}`}>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Video className="h-4 w-4 mr-2" />
                  {t('joinVideo')}
                </Button>
              </Link>
            )}
          {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
            <Button onClick={handleCheckIn} disabled={actionLoading}>
              <LogIn className="h-4 w-4 mr-2" />
              {t('checkIn')}
            </Button>
          )}
          {['CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status) && (
            <Button onClick={handleCheckOut} disabled={actionLoading}>
              <LogOut className="h-4 w-4 mr-2" />
              {t('checkOut')}
            </Button>
          )}
          {appointment.status === 'SCHEDULED' && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange('CONFIRMED')}
              disabled={actionLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('confirm')}
            </Button>
          )}
          <Link href={`/appointments/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              {t('edit')}
            </Button>
          </Link>
          {!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status) && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              disabled={actionLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('appointmentDetails')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('date')}</p>
                <p className="font-medium">{fmt.formatDate(appointment.scheduledDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('time')}</p>
                <p className="font-medium">{formatTime(appointment.scheduledTime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('duration')}</p>
                <p className="font-medium">{t('minutes', { minutes: appointment.duration })}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('chair')}</p>
                <p className="font-medium">
                  {appointment.chairNumber
                    ? t('chairNumber', { number: appointment.chairNumber })
                    : t('notAssigned')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('type')}</p>
                {getTypeBadge(appointment.appointmentType)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('priority')}</p>
                {getPriorityBadge(appointment.priority)}
              </div>
            </div>

            {(appointment.checkedInAt || appointment.checkedOutAt) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {appointment.checkedInAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('checkedIn')}</p>
                      <p className="font-medium">{fmt.formatTime(appointment.checkedInAt)}</p>
                    </div>
                  )}
                  {appointment.checkedOutAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('checkedOut')}</p>
                      <p className="font-medium">{fmt.formatTime(appointment.checkedOutAt)}</p>
                    </div>
                  )}
                  {appointment.waitTime !== null && appointment.waitTime > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('waitTime')}</p>
                      <p className="font-medium">
                        {t('minutes', { minutes: appointment.waitTime })}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {appointment.chiefComplaint && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">{t('chiefComplaint')}</p>
                  <p className="font-medium">{appointment.chiefComplaint}</p>
                </div>
              </>
            )}

            {appointment.notes && (
              <div>
                <p className="text-sm text-muted-foreground">{t('notes')}</p>
                <p className="font-medium">{appointment.notes}</p>
              </div>
            )}

            {appointment.status === 'CANCELLED' && (
              <>
                <Separator />
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-700">
                    {t('cancelledOn', { date: fmt.formatDateTime(appointment.cancelledAt!) })}
                  </p>
                  {appointment.cancellationReason && (
                    <p className="text-sm text-red-600 mt-1">
                      {t('reason', { reason: appointment.cancellationReason })}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('patientInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{getPatientName(appointment.patient)}</h3>
                <p className="text-muted-foreground">{appointment.patient.patientId}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.patient.phone}</span>
              </div>
              {appointment.patient.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.patient.email}</span>
                </div>
              )}
              {(appointment.patient.address || appointment.patient.city) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {[appointment.patient.address, appointment.patient.city]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>

            {appointment.patient.medicalHistory && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">{t('medicalAlerts')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {appointment.patient.medicalHistory.hasAllergies && (
                      <Badge variant="destructive">{t('allergies')}</Badge>
                    )}
                    {appointment.patient.medicalHistory.hasDiabetes && (
                      <Badge variant="secondary">{t('diabetes')}</Badge>
                    )}
                    {appointment.patient.medicalHistory.hasHypertension && (
                      <Badge variant="secondary">{t('hypertension')}</Badge>
                    )}
                    {appointment.patient.medicalHistory.hasHeartDisease && (
                      <Badge variant="destructive">{t('heartDisease')}</Badge>
                    )}
                  </div>
                  {appointment.patient.medicalHistory.drugAllergies && (
                    <p className="text-sm text-red-600 mt-2">
                      {t('drugAllergies', {
                        allergies: appointment.patient.medicalHistory.drugAllergies,
                      })}
                    </p>
                  )}
                  {appointment.patient.medicalHistory.currentMedications && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('currentMedications', {
                        medications: appointment.patient.medicalHistory.currentMedications,
                      })}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="pt-2">
              <Link href={`/patients/${appointment.patient.id}`}>
                <Button variant="outline" className="w-full">
                  {t('viewProfile')}
                </Button>
              </Link>
            </div>
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
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Stethoscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{getDoctorName(appointment.doctor)}</h3>
                {appointment.doctor.specialization && (
                  <p className="text-sm text-muted-foreground">
                    {appointment.doctor.specialization}
                  </p>
                )}
                {appointment.doctor.phone && (
                  <p className="text-sm text-muted-foreground">{appointment.doctor.phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Treatments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('treatments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointment.treatments.length === 0 ? (
              <p className="text-muted-foreground">{t('noTreatments')}</p>
            ) : (
              <div className="space-y-3">
                {appointment.treatments.map((treatment) => (
                  <div
                    key={treatment.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{treatment.procedure.name}</p>
                      <p className="text-sm text-muted-foreground">{treatment.treatmentNo}</p>
                    </div>
                    <Badge>{treatment.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
            <DialogDescription>{t('cancelDesc')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">{t('cancellationReason')}</Label>
            <Input
              id="reason"
              placeholder={t('cancellationPlaceholder')}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              {t('keepAppointment')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={actionLoading}
            >
              {t('cancelAppointment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
