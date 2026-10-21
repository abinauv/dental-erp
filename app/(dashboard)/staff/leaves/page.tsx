'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface LeaveRequest {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  reason: string | null
  status: string
  createdAt: string
  staff: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    user: {
      role: string
    }
  }
}

interface StaffMember {
  id: string
  employeeId: string
  firstName: string
  lastName: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const leaveTypeLabels: Record<string, string> = {
  CASUAL: 'Casual Leave',
  SICK: 'Sick Leave',
  EARNED: 'Earned Leave',
  UNPAID: 'Unpaid Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-muted text-foreground',
}

export default function LeavesPage() {
  const t = useTranslations('staff.leaves')
  const tType = useTranslations('staff.leaveType')
  const tStatus = useTranslations('staff.leaveStatus')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all')

  // New leave dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newLeaveForm, setNewLeaveForm] = useState({
    staffId: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  })

  // Approve/Reject action
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchLeaves = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (leaveTypeFilter !== 'all') params.append('leaveType', leaveTypeFilter)

      const response = await fetch(`/api/staff/leaves?${params}`)
      if (!response.ok) throw new Error('Failed to fetch leaves')

      const data = await response.json()
      setLeaves(data.leaves)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching leaves:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('fetchFailed'),
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff?all=true&status=active')
      if (!response.ok) throw new Error('Failed to fetch staff')

      const data = await response.json()
      setStaffList(data.staff)
    } catch (error) {
      console.error('Error fetching staff:', error)
    }
  }

  useEffect(() => {
    fetchLeaves()
    fetchStaff()
  }, [pagination.page, statusFilter, leaveTypeFilter])

  const handleCreateLeave = async () => {
    if (
      !newLeaveForm.staffId ||
      !newLeaveForm.leaveType ||
      !newLeaveForm.startDate ||
      !newLeaveForm.endDate
    ) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('requiredFields'),
      })
      return
    }

    try {
      setCreating(true)

      const response = await fetch('/api/staff/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLeaveForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t('createFailed'))
      }

      toast({
        title: t('success'),
        description: t('createSuccess'),
      })

      setNewDialogOpen(false)
      setNewLeaveForm({
        staffId: '',
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
      })
      fetchLeaves()
    } catch (error: any) {
      console.error('Error creating leave:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error.message || t('createFailed'),
      })
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateStatus = async (leaveId: string, newStatus: string) => {
    try {
      setActionLoading(leaveId)

      const response = await fetch(`/api/staff/leaves/${leaveId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update leave status')

      toast({
        title: t('success'),
        description: t('statusUpdated', {
          status: tStatus.has(newStatus)
            ? tStatus(newStatus).toLowerCase()
            : newStatus.toLowerCase(),
        }),
      })

      fetchLeaves()
    } catch (error) {
      console.error('Error updating leave:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('updateFailed'),
      })
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) =>
    fmt.formatDate(dateString, { day: 'numeric', month: 'short', year: 'numeric' })

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newLeaveRequest')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex gap-2 flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  <SelectItem value="PENDING">{tStatus('PENDING')}</SelectItem>
                  <SelectItem value="APPROVED">{tStatus('APPROVED')}</SelectItem>
                  <SelectItem value="REJECTED">{tStatus('REJECTED')}</SelectItem>
                  <SelectItem value="CANCELLED">{tStatus('CANCELLED')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('leaveTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTypes')}</SelectItem>
                  <SelectItem value="CASUAL">{tType('CASUAL')}</SelectItem>
                  <SelectItem value="SICK">{tType('SICK')}</SelectItem>
                  <SelectItem value="EARNED">{tType('EARNED')}</SelectItem>
                  <SelectItem value="UNPAID">{tType('UNPAID')}</SelectItem>
                  <SelectItem value="MATERNITY">{tType('MATERNITY')}</SelectItem>
                  <SelectItem value="PATERNITY">{tType('PATERNITY')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaves Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('colEmployee')}</TableHead>
                <TableHead>{t('colLeaveType')}</TableHead>
                <TableHead>{t('colDuration')}</TableHead>
                <TableHead>{t('colDays')}</TableHead>
                <TableHead>{t('colReason')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">{t('noLeaves')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {leave.staff.firstName} {leave.staff.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {leave.staff.employeeId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tType.has(leave.leaveType)
                          ? tType(leave.leaveType)
                          : leaveTypeLabels[leave.leaveType] || leave.leaveType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {t('durationRange', {
                          start: formatDate(leave.startDate),
                          end: formatDate(leave.endDate),
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t('daysCount', { days: calculateDays(leave.startDate, leave.endDate) })}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {leave.reason || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[leave.status]} border-0`}>
                        {tStatus.has(leave.status) ? tStatus(leave.status) : leave.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {leave.status === 'PENDING' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleUpdateStatus(leave.id, 'APPROVED')}
                            disabled={actionLoading === leave.id}
                          >
                            {actionLoading === leave.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleUpdateStatus(leave.id, 'REJECTED')}
                            disabled={actionLoading === leave.id}
                          >
                            {actionLoading === leave.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
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

      {/* New Leave Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newLeaveRequest')}</DialogTitle>
            <DialogDescription>{t('newDialogDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('staffMember')}</Label>
              <Select
                value={newLeaveForm.staffId}
                onValueChange={(value) => setNewLeaveForm((prev) => ({ ...prev, staffId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectStaff')} />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {t('staffOption', {
                        name: `${staff.firstName} ${staff.lastName}`,
                        employeeId: staff.employeeId,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('leaveTypeLabel')}</Label>
              <Select
                value={newLeaveForm.leaveType}
                onValueChange={(value) =>
                  setNewLeaveForm((prev) => ({ ...prev, leaveType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectLeaveType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASUAL">{tType('CASUAL')}</SelectItem>
                  <SelectItem value="SICK">{tType('SICK')}</SelectItem>
                  <SelectItem value="EARNED">{tType('EARNED')}</SelectItem>
                  <SelectItem value="UNPAID">{tType('UNPAID')}</SelectItem>
                  <SelectItem value="MATERNITY">{tType('MATERNITY')}</SelectItem>
                  <SelectItem value="PATERNITY">{tType('PATERNITY')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('startDate')}</Label>
                <Input
                  type="date"
                  value={newLeaveForm.startDate}
                  onChange={(e) =>
                    setNewLeaveForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('endDate')}</Label>
                <Input
                  type="date"
                  value={newLeaveForm.endDate}
                  onChange={(e) =>
                    setNewLeaveForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reason')}</Label>
              <Textarea
                value={newLeaveForm.reason}
                onChange={(e) => setNewLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={t('reasonPlaceholder')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateLeave} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
