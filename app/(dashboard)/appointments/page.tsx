'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calendar,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  User,
  Phone,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Eye,
  Edit,
  CalendarDays,
  List,
  Brain,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  appointmentStatusConfig,
  appointmentTypeConfig,
  formatTime,
  formatDate,
  getPatientName,
  getDoctorName,
} from '@/lib/appointment-utils'
import { ExportMenu } from '@/components/ui/export-menu'

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
  checkedOutAt: string | null
  waitTime: number | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AppointmentsPage() {
  const router = useRouter()
  const t = useTranslations('appointments.list')
  const tStatus = useTranslations('appointments.status')
  const tType = useTranslations('appointments.type')
  const fmt = useClinicFormatters()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  // AI no-show risk
  const [riskMap, setRiskMap] = useState<
    Record<
      string,
      { riskScore: number; riskLevel: string; factors: string[]; recommendation: string }
    >
  >({})
  const [riskLoading, setRiskLoading] = useState(false)
  const [showRisk, setShowRisk] = useState(false)

  const fetchNoShowRisk = async () => {
    try {
      setRiskLoading(true)
      const res = await fetch('/api/ai/no-show-risk?days=14')
      if (!res.ok) return
      const data = await res.json()
      const map: typeof riskMap = {}
      for (const pred of data.predictions || []) {
        map[pred.appointmentId] = {
          riskScore: pred.riskScore,
          riskLevel: pred.riskLevel,
          factors: pred.factors || [],
          recommendation: pred.recommendation || '',
        }
      }
      setRiskMap(map)
      setShowRisk(true)
    } catch {
      // non-critical
    } finally {
      setRiskLoading(false)
    }
  }

  const getRiskBadge = (appointmentId: string) => {
    const risk = riskMap[appointmentId]
    if (!risk) return null
    const config = {
      LOW: { color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
      MEDIUM: { color: 'text-amber-700', bgColor: 'bg-amber-100', icon: AlertTriangle },
      HIGH: { color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertTriangle },
    }[risk.riskLevel] || {
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      icon: AlertTriangle,
    }
    const Icon = config.icon
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${config.bgColor} ${config.color} border-0 text-xs cursor-help`}>
            <Icon className="h-3 w-3 mr-1" />
            {risk.riskScore}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[250px]">
          <p className="font-medium mb-1">{t('noShowRisk', { level: risk.riskLevel })}</p>
          {risk.factors.map((f, i) => (
            <p key={i} className="text-xs">
              • {f}
            </p>
          ))}
          {risk.recommendation && <p className="text-xs mt-1 font-medium">{risk.recommendation}</p>}
        </TooltipContent>
      </Tooltip>
    )
  }

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        view: 'list',
      })

      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter)
      if (dateFilter) params.append('date', dateFilter)

      const response = await fetch(`/api/appointments?${params}`)
      if (!response.ok) throw new Error('Failed to fetch appointments')

      const data = await response.json()
      setAppointments(data.appointments)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [pagination.page, search, statusFilter, typeFilter, dateFilter])

  const handleCheckIn = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}/check-in`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to check in')
      fetchAppointments()
    } catch (error) {
      console.error('Error checking in:', error)
    }
  }

  const handleCheckOut = async (id: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}/check-out`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to check out')
      fetchAppointments()
    } catch (error) {
      console.error('Error checking out:', error)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      fetchAppointments()
    } catch (error) {
      console.error('Error updating status:', error)
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
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {label}
      </Badge>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              {t('viewList')}
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              {t('viewCalendar')}
            </Button>
            <ExportMenu
              filename="appointments"
              getData={() =>
                appointments.map((a) => ({
                  'Appointment No': a.appointmentNo,
                  Patient: getPatientName(a.patient),
                  'Patient Phone': a.patient.phone,
                  Doctor: getDoctorName(a.doctor),
                  Specialization: a.doctor.specialization || '',
                  Date: formatDate(a.scheduledDate),
                  Time: formatTime(a.scheduledTime),
                  'Duration (min)': a.duration,
                  Chair: a.chairNumber || '',
                  Type: a.appointmentType,
                  Status: a.status,
                  Priority: a.priority,
                  'Chief Complaint': a.chiefComplaint || '',
                }))
              }
            />
            <Button variant="outline" size="sm" onClick={fetchNoShowRisk} disabled={riskLoading}>
              {riskLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              {showRisk ? t('refreshRisk') : t('aiRisk')}
            </Button>
            <Link href="/appointments/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('newAppointment')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t('statusPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allStatus')}</SelectItem>
                    <SelectItem value="SCHEDULED">{tStatus('SCHEDULED')}</SelectItem>
                    <SelectItem value="CONFIRMED">{tStatus('CONFIRMED')}</SelectItem>
                    <SelectItem value="CHECKED_IN">{tStatus('CHECKED_IN')}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{tStatus('IN_PROGRESS')}</SelectItem>
                    <SelectItem value="COMPLETED">{tStatus('COMPLETED')}</SelectItem>
                    <SelectItem value="CANCELLED">{tStatus('CANCELLED')}</SelectItem>
                    <SelectItem value="NO_SHOW">{tStatus('NO_SHOW')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t('typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allTypes')}</SelectItem>
                    <SelectItem value="CONSULTATION">{tType('CONSULTATION')}</SelectItem>
                    <SelectItem value="PROCEDURE">{tType('PROCEDURE')}</SelectItem>
                    <SelectItem value="FOLLOW_UP">{tType('FOLLOW_UP')}</SelectItem>
                    <SelectItem value="EMERGENCY">{tType('EMERGENCY')}</SelectItem>
                    <SelectItem value="CHECK_UP">{tType('CHECK_UP')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colAppointment')}</TableHead>
                  <TableHead>{t('colPatient')}</TableHead>
                  <TableHead>{t('colDoctor')}</TableHead>
                  <TableHead>{t('colDateTime')}</TableHead>
                  <TableHead>{t('colType')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  {showRisk && <TableHead>{t('colRisk')}</TableHead>}
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : appointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">{t('noAppointments')}</p>
                        <Link href="/appointments/new">
                          <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            {t('bookNew')}
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  appointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <div className="font-medium">{appointment.appointmentNo}</div>
                        {appointment.chairNumber && (
                          <div className="text-sm text-muted-foreground">
                            {t('chair', { number: appointment.chairNumber })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{getPatientName(appointment.patient)}</div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {appointment.patient.phone}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{getDoctorName(appointment.doctor)}</div>
                        {appointment.doctor.specialization && (
                          <div className="text-sm text-muted-foreground">
                            {appointment.doctor.specialization}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {fmt.formatDate(appointment.scheduledDate)}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(appointment.scheduledTime)}
                              <span className="text-xs">
                                {t('duration', { minutes: appointment.duration })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(appointment.appointmentType)}</TableCell>
                      <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                      {showRisk && (
                        <TableCell>
                          {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) ? (
                            getRiskBadge(appointment.id)
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('na')}</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/appointments/${appointment.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/appointments/${appointment.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                              <DropdownMenuItem onClick={() => handleCheckIn(appointment.id)}>
                                <LogIn className="h-4 w-4 mr-2" />
                                {t('checkIn')}
                              </DropdownMenuItem>
                            )}
                            {['CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status) && (
                              <DropdownMenuItem onClick={() => handleCheckOut(appointment.id)}>
                                <LogOut className="h-4 w-4 mr-2" />
                                {t('checkOut')}
                              </DropdownMenuItem>
                            )}
                            {appointment.status === 'SCHEDULED' && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment.id, 'CONFIRMED')}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {t('confirm')}
                              </DropdownMenuItem>
                            )}
                            {!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(
                              appointment.status
                            ) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(appointment.id, 'NO_SHOW')}
                                  className="text-amber-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {t('markNoShow')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(appointment.id, 'CANCELLED')}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {t('cancel')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {!loading && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-4">
                <div className="text-sm text-muted-foreground">
                  {t('showing', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('previous')}
                  </Button>
                  <div className="text-sm">
                    {t('pageOf', { page: pagination.page, total: pagination.totalPages })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    {t('next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
