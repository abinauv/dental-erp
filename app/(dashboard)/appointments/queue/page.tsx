'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  User,
  Phone,
  LogIn,
  LogOut,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Timer,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import {
  appointmentStatusConfig,
  appointmentTypeConfig,
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
  checkedInAt: string | null
  waitTime: number | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
  }
}

interface QueueStats {
  total: number
  waiting: number
  inProgress: number
  upcoming: number
  completed: number
  noShow: number
  cancelled: number
  avgWaitTime: number
}

interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string | null
}

export default function QueueManagementPage() {
  const router = useRouter()
  const t = useTranslations('appointments.queue')
  const tStatus = useTranslations('appointments.status')
  const tType = useTranslations('appointments.type')
  const fmt = useClinicFormatters()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [queue, setQueue] = useState<{
    waiting: Appointment[]
    inProgress: Appointment[]
    upcoming: Appointment[]
    completed: Appointment[]
  }>({
    waiting: [],
    inProgress: [],
    upcoming: [],
    completed: [],
  })
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    waiting: 0,
    inProgress: 0,
    upcoming: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
    avgWaitTime: 0,
  })

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState('all')

  const fetchQueue = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDoctor) params.append('doctorId', selectedDoctor)

      const response = await fetch(`/api/appointments/today?${params}`)
      if (response.ok) {
        const data = await response.json()
        setQueue(data.queue)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching queue:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchDoctors = async () => {
    try {
      const response = await fetch('/api/staff/doctors')
      if (response.ok) {
        const data = await response.json()
        setDoctors(data.doctors)
      }
    } catch (error) {
      console.error('Error fetching doctors:', error)
    }
  }

  useEffect(() => {
    fetchDoctors()
  }, [])

  useEffect(() => {
    fetchQueue()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [selectedDoctor])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchQueue()
  }

  const handleCheckIn = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}/check-in`, {
        method: 'POST',
      })
      if (response.ok) fetchQueue()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleCheckOut = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}/check-out`, {
        method: 'POST',
      })
      if (response.ok) fetchQueue()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleStartProgress = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      if (response.ok) fetchQueue()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleNoShow = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'NO_SHOW' }),
      })
      if (response.ok) fetchQueue()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = appointmentStatusConfig[status] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{label}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const config = appointmentTypeConfig[type] || {
      label: type,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
    }
    const label = tType.has(type) ? tType(type) : config.label
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 text-xs`}>
        {label}
      </Badge>
    )
  }

  const getPriorityIndicator = (priority: string) => {
    if (priority === 'URGENT') {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    if (priority === 'HIGH') {
      return <AlertCircle className="h-4 w-4 text-orange-500" />
    }
    return null
  }

  const AppointmentCard = ({
    appointment,
    showActions = true,
  }: {
    appointment: Appointment
    showActions?: boolean
  }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{getPatientName(appointment.patient)}</p>
                {getPriorityIndicator(appointment.priority)}
              </div>
              <p className="text-sm text-muted-foreground">{appointment.patient.patientId}</p>
              <div className="flex items-center gap-2 mt-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{appointment.patient.phone}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatTime(appointment.scheduledTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getDoctorName(appointment.doctor)}
            </p>
            {appointment.chairNumber && (
              <p className="text-xs text-muted-foreground">
                {t('chair', { number: appointment.chairNumber })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {getTypeBadge(appointment.appointmentType)}
          {getStatusBadge(appointment.status)}
          {appointment.waitTime !== null && appointment.waitTime > 0 && (
            <Badge variant="outline" className="text-xs">
              <Timer className="h-3 w-3 mr-1" />
              {t('minWait', { minutes: appointment.waitTime })}
            </Badge>
          )}
        </div>

        {appointment.chiefComplaint && (
          <p className="text-sm text-muted-foreground mt-2 italic">
            &quot;{appointment.chiefComplaint}&quot;
          </p>
        )}

        {showActions && (
          <div className="flex gap-2 mt-3">
            {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
              <>
                <Button size="sm" onClick={() => handleCheckIn(appointment.id)}>
                  <LogIn className="h-4 w-4 mr-1" />
                  {t('checkIn')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleNoShow(appointment.id)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {t('noShowAction')}
                </Button>
              </>
            )}
            {appointment.status === 'CHECKED_IN' && (
              <>
                <Button size="sm" onClick={() => handleStartProgress(appointment.id)}>
                  <Play className="h-4 w-4 mr-1" />
                  {t('start')}
                </Button>
              </>
            )}
            {['CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status) && (
              <Button size="sm" variant="outline" onClick={() => handleCheckOut(appointment.id)}>
                <LogOut className="h-4 w-4 mr-1" />
                {t('complete')}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/appointments/${appointment.id}`)}
            >
              {t('view')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const today = fmt.formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{today}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('allDoctors')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allDoctors')}</SelectItem>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {t('doctorName', { name: `${doctor.firstName} ${doctor.lastName}` })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          <Link href="/appointments/new">
            <Button>
              <Calendar className="h-4 w-4 mr-2" />
              {t('newAppointment')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('total')}</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700">{t('waiting')}</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats.waiting}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-purple-700">{t('inProgress')}</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700">{t('upcoming')}</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{stats.upcoming}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">{t('completed')}</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">{t('noShow')}</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.noShow}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('avgWait')}</span>
            </div>
            <p className="text-2xl font-bold">{t('minutes', { minutes: stats.avgWaitTime })}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Waiting */}
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50 border-b border-amber-200">
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <Clock className="h-5 w-5" />
                {t('waitingCount', { count: queue.waiting.length })}
              </CardTitle>
              <CardDescription>{t('waitingDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 max-h-[500px] overflow-y-auto">
              {queue.waiting.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('noWaiting')}</p>
              ) : (
                queue.waiting.map((apt) => <AppointmentCard key={apt.id} appointment={apt} />)
              )}
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50 border-b border-purple-200">
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <Play className="h-5 w-5" />
                {t('inProgressCount', { count: queue.inProgress.length })}
              </CardTitle>
              <CardDescription>{t('inProgressDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 max-h-[500px] overflow-y-auto">
              {queue.inProgress.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('noInProgress')}</p>
              ) : (
                queue.inProgress.map((apt) => <AppointmentCard key={apt.id} appointment={apt} />)
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card className="border-blue-200">
            <CardHeader className="bg-blue-50 border-b border-blue-200">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Calendar className="h-5 w-5" />
                {t('upcomingCount', { count: queue.upcoming.length })}
              </CardTitle>
              <CardDescription>{t('upcomingDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 max-h-[500px] overflow-y-auto">
              {queue.upcoming.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('noUpcoming')}</p>
              ) : (
                queue.upcoming.map((apt) => <AppointmentCard key={apt.id} appointment={apt} />)
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Completed Section */}
      {queue.completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              {t('completedToday', { count: queue.completed.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {queue.completed.slice(0, 6).map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} showActions={false} />
              ))}
            </div>
            {queue.completed.length > 6 && (
              <div className="text-center mt-4">
                <Link href="/appointments?status=COMPLETED">
                  <Button variant="outline">
                    {t('viewAllCompleted', { count: queue.completed.length })}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
