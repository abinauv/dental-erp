'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  MoreHorizontal,
  Eye,
  Edit,
  FlaskConical,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Package,
  Truck,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExportMenu } from '@/components/ui/export-menu'

interface LabOrder {
  id: string
  orderNumber: string
  patientId: string
  patientName: string
  patientPhone: string
  labVendorId: string
  vendorName: string
  vendorPhone: string
  workType: string
  description: string
  toothNumbers: string
  shadeGuide: string
  orderDate: string
  expectedDate: string
  sentDate: string | null
  receivedDate: string | null
  deliveredDate: string | null
  estimatedCost: number
  actualCost: number | null
  status: string
  qualityCheck: string
  qualityNotes: string | null
  priority: string
  notes: string
  createdByName: string
  createdAt: string
}

interface LabVendor {
  id: string
  name: string
  code: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

interface Stats {
  total: number
  created: number
  sentToLab: number
  inProgress: number
  ready: number
  delivered: number
  cancelled: number
}

export default function LabWorkPage() {
  const router = useRouter()
  const t = useTranslations('lab.list')
  const tStatus = useTranslations('lab.status')
  const tPriority = useTranslations('lab.priority')
  const tWorkType = useTranslations('lab.workType')
  const fmt = useClinicFormatters()
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [vendors, setVendors] = useState<LabVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total: 0,
    created: 0,
    sentToLab: 0,
    inProgress: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0,
  })
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [workTypeFilter, setWorkTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/lab-vendors?status=active')
      if (!response.ok) throw new Error('Failed to fetch vendors')
      const data = await response.json()
      setVendors(data.data)
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (vendorFilter && vendorFilter !== 'all') params.append('vendorId', vendorFilter)
      if (workTypeFilter && workTypeFilter !== 'all') params.append('workType', workTypeFilter)
      if (priorityFilter && priorityFilter !== 'all') params.append('priority', priorityFilter)

      const response = await fetch(`/api/lab-orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch lab orders')

      const data = await response.json()
      setOrders(data.data)
      setPagination(data.pagination)

      // Calculate stats
      calculateStats(data.data)
    } catch (error) {
      console.error('Error fetching lab orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (orders: LabOrder[]) => {
    const newStats = {
      total: orders.length,
      created: orders.filter((o) => o.status === 'CREATED').length,
      sentToLab: orders.filter((o) => o.status === 'SENT_TO_LAB').length,
      inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
      ready: orders.filter((o) => o.status === 'READY').length,
      delivered: orders.filter((o) => o.status === 'DELIVERED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    }
    setStats(newStats)
  }

  useEffect(() => {
    fetchVendors()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, search, statusFilter, vendorFilter, workTypeFilter, priorityFilter])

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string; icon: any }> = {
      CREATED: {
        label: 'Created',
        className: 'bg-muted text-foreground',
        icon: Package,
      },
      SENT_TO_LAB: {
        label: 'Sent to Lab',
        className: 'bg-blue-100 text-blue-800',
        icon: Truck,
      },
      IN_PROGRESS: {
        label: 'In Progress',
        className: 'bg-yellow-100 text-yellow-800',
        icon: Clock,
      },
      QUALITY_CHECK: {
        label: 'Quality Check',
        className: 'bg-purple-100 text-purple-800',
        icon: FlaskConical,
      },
      READY: {
        label: 'Ready',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle,
      },
      DELIVERED: {
        label: 'Delivered',
        className: 'bg-emerald-100 text-emerald-800',
        icon: CheckCircle,
      },
      FITTED: {
        label: 'Fitted',
        className: 'bg-teal-100 text-teal-800',
        icon: CheckCircle,
      },
      REMAKE_REQUIRED: {
        label: 'Remake Required',
        className: 'bg-orange-100 text-orange-800',
        icon: AlertCircle,
      },
      CANCELLED: {
        label: 'Cancelled',
        className: 'bg-red-100 text-red-800',
        icon: XCircle,
      },
    }

    const config = configs[status] || configs.CREATED
    const Icon = config.icon
    const label = tStatus.has(status) ? tStatus(status) : config.label

    return (
      <Badge className={config.className}>
        <Icon className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const configs: Record<string, { className: string }> = {
      normal: { className: 'bg-muted text-foreground' },
      urgent: { className: 'bg-orange-100 text-orange-800' },
      rush: { className: 'bg-red-100 text-red-800' },
    }

    const config = configs[priority] || configs.normal
    const label = tPriority.has(priority) ? tPriority(priority) : priority
    return <Badge className={config.className}>{label}</Badge>
  }

  // workType is the LabWorkType enum (NIGHT_GUARD, ...); prefer the catalogue
  // label, falling back to title-casing the enum.
  const formatWorkType = (workType: string) =>
    tWorkType.has(workType)
      ? tWorkType(workType)
      : workType
          .toLowerCase()
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

  const formatDate = (dateString: string | null) =>
    fmt.formatDate(dateString, { day: '2-digit', month: 'short', year: 'numeric' })

  const formatCurrency = (amount: number) =>
    fmt.formatCurrency(amount, { maximumFractionDigits: 0 })

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            filename="lab-orders"
            getData={() =>
              orders.map((o) => ({
                'Order No': o.orderNumber,
                Patient: o.patientName,
                'Patient Phone': o.patientPhone,
                Vendor: o.vendorName,
                'Work Type': formatWorkType(o.workType),
                Description: o.description || '',
                'Tooth Numbers': o.toothNumbers || '',
                'Shade Guide': o.shadeGuide || '',
                'Order Date': formatDate(o.orderDate),
                'Expected Date': formatDate(o.expectedDate),
                'Sent Date': formatDate(o.sentDate),
                'Received Date': formatDate(o.receivedDate),
                'Delivered Date': formatDate(o.deliveredDate),
                'Estimated Cost': o.estimatedCost,
                'Actual Cost': o.actualCost || '',
                Status: o.status,
                Priority: o.priority,
                'Quality Check': o.qualityCheck,
                Notes: o.notes || '',
              }))
            }
          />
          <Button variant="outline" onClick={() => router.push('/lab/vendors')}>
            <Users className="mr-2 h-4 w-4" />
            {t('manageVendors')}
          </Button>
          <Button onClick={() => router.push('/lab/orders/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newLabOrder')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalOrders')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('sentToLab')}</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentToLab}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('inProgress')}</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ready')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ready}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('delivered')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.delivered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('cancelled')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('created')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.created}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="CREATED">{tStatus('CREATED')}</SelectItem>
                <SelectItem value="SENT_TO_LAB">{tStatus('SENT_TO_LAB')}</SelectItem>
                <SelectItem value="IN_PROGRESS">{tStatus('IN_PROGRESS')}</SelectItem>
                <SelectItem value="QUALITY_CHECK">{tStatus('QUALITY_CHECK')}</SelectItem>
                <SelectItem value="READY">{tStatus('READY')}</SelectItem>
                <SelectItem value="DELIVERED">{tStatus('DELIVERED')}</SelectItem>
                <SelectItem value="FITTED">{tStatus('FITTED')}</SelectItem>
                <SelectItem value="REMAKE_REQUIRED">{tStatus('REMAKE_REQUIRED')}</SelectItem>
                <SelectItem value="CANCELLED">{tStatus('CANCELLED')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('allVendors')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allVendors')}</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('allWorkTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allWorkTypes')}</SelectItem>
                <SelectItem value="CROWN">{tWorkType('CROWN')}</SelectItem>
                <SelectItem value="BRIDGE">{tWorkType('BRIDGE')}</SelectItem>
                <SelectItem value="DENTURE">{tWorkType('DENTURE')}</SelectItem>
                <SelectItem value="PARTIAL_DENTURE">{tWorkType('PARTIAL_DENTURE')}</SelectItem>
                <SelectItem value="IMPLANT_CROWN">{tWorkType('IMPLANT_CROWN')}</SelectItem>
                <SelectItem value="VENEER">{tWorkType('VENEER')}</SelectItem>
                <SelectItem value="INLAY_ONLAY">{tWorkType('INLAY_ONLAY')}</SelectItem>
                <SelectItem value="NIGHT_GUARD">{tWorkType('NIGHT_GUARD')}</SelectItem>
                <SelectItem value="RETAINER">{tWorkType('RETAINER')}</SelectItem>
                <SelectItem value="ALIGNER">{tWorkType('ALIGNER')}</SelectItem>
                <SelectItem value="MODEL">{tWorkType('MODEL')}</SelectItem>
                <SelectItem value="OTHER">{tWorkType('OTHER')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('allPriorities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allPriorities')}</SelectItem>
                <SelectItem value="normal">{tPriority('normal')}</SelectItem>
                <SelectItem value="urgent">{tPriority('urgent')}</SelectItem>
                <SelectItem value="rush">{tPriority('rush')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{t('noOrders')}</h3>
              <p className="text-muted-foreground">{t('noOrdersHint')}</p>
              <Button className="mt-4" onClick={() => router.push('/lab/orders/new')}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createLabOrder')}
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colOrderNo')}</TableHead>
                    <TableHead>{t('colPatient')}</TableHead>
                    <TableHead>{t('colWorkType')}</TableHead>
                    <TableHead>{t('colVendor')}</TableHead>
                    <TableHead>{t('colOrderDate')}</TableHead>
                    <TableHead>{t('colExpected')}</TableHead>
                    <TableHead>{t('colStatus')}</TableHead>
                    <TableHead>{t('colPriority')}</TableHead>
                    <TableHead>{t('colCost')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.patientName}</div>
                          <div className="text-sm text-muted-foreground">{order.patientPhone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatWorkType(order.workType)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.vendorName}</div>
                          <div className="text-sm text-muted-foreground">{order.vendorPhone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>{formatDate(order.expectedDate)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                      <TableCell>{formatCurrency(order.estimatedCost)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/lab/orders/${order.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/lab/orders/${order.id}/edit`)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {t('editOrder')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {t('showing', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.pages}
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  >
                    {t('next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
