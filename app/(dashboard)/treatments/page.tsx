'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  MoreHorizontal,
  Eye,
  Edit,
  Play,
  CheckCircle,
  Stethoscope,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  treatmentStatusConfig,
  procedureCategoryConfig,
  formatDate,
  formatToothNumbers,
  parseToothNumbers,
} from '@/lib/treatment-utils'
import { ExportMenu } from '@/components/ui/export-menu'

interface Treatment {
  id: string
  treatmentNo: string
  chiefComplaint: string | null
  diagnosis: string | null
  toothNumbers: string | null
  status: string
  cost: string | number
  followUpRequired: boolean
  followUpDate: string | null
  createdAt: string
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
  procedure: {
    id: string
    code: string
    name: string
    category: string
  }
  appointment: {
    id: string
    appointmentNo: string
    scheduledDate: string
  } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function TreatmentsPage() {
  const router = useRouter()
  const t = useTranslations('treatments.list')
  const tStatus = useTranslations('treatments.status')
  const tCategory = useTranslations('treatments.category')
  const fmt = useClinicFormatters()
  const [treatments, setTreatments] = useState<Treatment[]>([])
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
  const [followUpFilter, setFollowUpFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchTreatments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (followUpFilter === 'required') params.append('followUpRequired', 'true')
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)

      const response = await fetch(`/api/treatments?${params}`)
      if (!response.ok) throw new Error('Failed to fetch treatments')

      const data = await response.json()
      setTreatments(data.treatments)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching treatments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTreatments()
  }, [pagination.page, search, statusFilter, followUpFilter, dateFrom, dateTo])

  const handleStartTreatment = async (id: string) => {
    try {
      const response = await fetch(`/api/treatments/${id}/start`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to start treatment')
      fetchTreatments()
    } catch (error) {
      console.error('Error starting treatment:', error)
    }
  }

  const handleCompleteTreatment = async (id: string) => {
    try {
      const response = await fetch(`/api/treatments/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error('Failed to complete treatment')
      fetchTreatments()
    } catch (error) {
      console.error('Error completing treatment:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = treatmentStatusConfig[status] || {
      label: status,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    }
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{label}</Badge>
  }

  const getCategoryBadge = (category: string) => {
    const config = procedureCategoryConfig[category] || {
      label: category,
      color: 'text-foreground',
      bgColor: 'bg-muted/50',
    }
    const label = tCategory.has(category) ? tCategory(category) : config.label
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            filename="treatments"
            getData={() =>
              treatments.map((t) => ({
                'Treatment No': t.treatmentNo,
                Patient: `${t.patient.firstName} ${t.patient.lastName}`,
                'Patient ID': t.patient.patientId,
                'Patient Phone': t.patient.phone,
                Doctor: `Dr. ${t.doctor.firstName} ${t.doctor.lastName}`,
                Specialization: t.doctor.specialization || '',
                Procedure: t.procedure.name,
                'Procedure Code': t.procedure.code,
                Category: t.procedure.category,
                Diagnosis: t.diagnosis || '',
                'Chief Complaint': t.chiefComplaint || '',
                Teeth: t.toothNumbers || '',
                Cost: Number(t.cost),
                Status: t.status,
                'Follow-up Required': t.followUpRequired ? 'Yes' : 'No',
                'Follow-up Date': t.followUpDate || '',
                Date: formatDate(t.createdAt),
              }))
            }
          />
          <Link href="/treatments/plans">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              {t('treatmentPlans')}
            </Button>
          </Link>
          <Link href="/treatments/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('newTreatment')}
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
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  <SelectItem value="PLANNED">{tStatus('PLANNED')}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{tStatus('IN_PROGRESS')}</SelectItem>
                  <SelectItem value="COMPLETED">{tStatus('COMPLETED')}</SelectItem>
                  <SelectItem value="CANCELLED">{tStatus('CANCELLED')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={followUpFilter} onValueChange={setFollowUpFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('followUpPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTreatments')}</SelectItem>
                  <SelectItem value="required">{t('followUpRequired')}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From Date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To Date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Treatments Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('colTreatment')}</TableHead>
                <TableHead>{t('colPatient')}</TableHead>
                <TableHead>{t('colProcedure')}</TableHead>
                <TableHead>{t('colDoctor')}</TableHead>
                <TableHead>{t('colTeeth')}</TableHead>
                <TableHead>{t('colCost')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
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
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
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
              ) : treatments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Stethoscope className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">{t('noTreatments')}</p>
                      <Link href="/treatments/new">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          {t('createNew')}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                treatments.map((treatment) => (
                  <TableRow key={treatment.id}>
                    <TableCell>
                      <div className="font-medium">{treatment.treatmentNo}</div>
                      <div className="text-sm text-muted-foreground">
                        {fmt.formatDate(treatment.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {treatment.patient.firstName} {treatment.patient.lastName}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {treatment.patient.phone}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{treatment.procedure.name}</div>
                      <div className="mt-1">{getCategoryBadge(treatment.procedure.category)}</div>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {treatment.toothNumbers ? (
                        <div className="text-sm font-medium">
                          {formatToothNumbers(parseToothNumbers(treatment.toothNumbers))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{fmt.formatCurrency(treatment.cost)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(treatment.status)}
                        {treatment.followUpRequired && (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            {t('followUp')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/treatments/${treatment.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('viewDetails')}
                          </DropdownMenuItem>
                          {treatment.status !== 'COMPLETED' && treatment.status !== 'CANCELLED' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/treatments/${treatment.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('edit')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {treatment.status === 'PLANNED' && (
                            <DropdownMenuItem onClick={() => handleStartTreatment(treatment.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              {t('startTreatment')}
                            </DropdownMenuItem>
                          )}
                          {treatment.status === 'IN_PROGRESS' && (
                            <DropdownMenuItem onClick={() => handleCompleteTreatment(treatment.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {t('completeTreatment')}
                            </DropdownMenuItem>
                          )}
                          {treatment.appointment && (
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/appointments/${treatment.appointment!.id}`)
                              }
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              {t('viewAppointment')}
                            </DropdownMenuItem>
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
  )
}
