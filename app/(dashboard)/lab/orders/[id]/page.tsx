'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Edit, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

// The lab list's colours for each status.
const STATUS_STYLES: Record<string, string> = {
  CREATED: 'bg-muted text-foreground',
  SENT_TO_LAB: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  QUALITY_CHECK: 'bg-purple-100 text-purple-800',
  READY: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  FITTED: 'bg-teal-100 text-teal-800',
  REMAKE_REQUIRED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800',
}
const STATUSES = Object.keys(STATUS_STYLES)

interface LabOrderDetail {
  id: string
  orderNumber: string
  status: string
  priority: string
  workType: string
  description: string | null
  toothNumbers: string | null
  shadeGuide: string | null
  orderDate: string
  expectedDate: string | null
  sentDate: string | null
  receivedDate: string | null
  deliveredDate: string | null
  estimatedCost: string | number
  actualCost: string | number | null
  qualityCheck: string | null
  qualityNotes: string | null
  notes: string | null
  specialInstructions: string | null
  patientId: string
  patientCode: string
  patientName: string
  patientPhone: string
  vendorName: string
  vendorPhone: string | null
  vendorEmail: string | null
  createdByName: string | null
  history: {
    id: string
    statusFrom: string | null
    statusTo: string
    notes: string | null
    createdAt: string
    changedByName: string | null
  }[]
  documents: {
    id: string
    fileName: string
    fileUrl: string
    documentType: string | null
    createdAt: string
    uploadedByName: string | null
  }[]
}

export default function LabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations('lab.orderDetail')
  const tStatus = useTranslations('lab.status')
  const tPriority = useTranslations('lab.priority')
  const tWorkType = useTranslations('lab.workType')
  const { toast } = useToast()
  const { formatDate, formatCurrency } = useClinicFormatters()
  const [order, setOrder] = useState<LabOrderDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [updating, setUpdating] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/lab-orders/${id}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.data) setNotFound(true)
        else {
          setOrder(json.data)
          setNextStatus(json.data.status)
        }
      })
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(load, [load])

  async function updateStatus() {
    if (!order || nextStatus === order.status) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/lab-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast({ title: t('statusUpdated') })
      load()
    } catch (error) {
      toast({
        title: error instanceof Error && error.message ? error.message : t('statusFailed'),
        variant: 'destructive',
      })
    } finally {
      setUpdating(false)
    }
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-muted-foreground">{t('notFound')}</p>
          <Button asChild variant="outline">
            <Link href="/lab">{t('backToLab')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  const statusLabel = (status: string) => (tStatus.has(status) ? tStatus(status) : status)
  const priority = order.priority?.toLowerCase()
  const date = (value: string | null) => (value ? formatDate(value) : '-')
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
            {order.orderNumber}
            <Badge className={`${STATUS_STYLES[order.status] ?? ''} border-0`}>
              {statusLabel(order.status)}
            </Badge>
            {priority && priority !== 'normal' && (
              <Badge variant="outline">
                {tPriority.has(priority) ? tPriority(priority) : priority}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {tWorkType.has(order.workType) ? tWorkType(order.workType) : order.workType}
          </p>
        </div>
        <div className="page-actions">
          <Button asChild>
            <Link href={`/lab/orders/${order.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              {t('edit')}
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <span className="text-sm font-medium">{t('changeStatus')}</span>
          <Select value={nextStatus} onValueChange={setNextStatus}>
            <SelectTrigger className="sm:w-56" aria-label={t('changeStatus')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={updateStatus}
            disabled={updating || nextStatus === order.status}
          >
            {updating ? t('updating') : t('updateStatus')}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('work')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row(
              t('patient'),
              <Link href={`/patients/${order.patientId}`} className="text-primary hover:underline">
                {order.patientName} ({order.patientCode})
              </Link>
            )}
            {row(t('teeth'), order.toothNumbers || '-')}
            {row(t('shade'), order.shadeGuide || '-')}
            {row(t('createdBy'), order.createdByName || '-')}
            {order.description && (
              <div className="py-2 text-sm">
                <p className="text-muted-foreground">{t('description')}</p>
                <p className="mt-1 whitespace-pre-wrap">{order.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('lab')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.vendorName}</p>
            {order.vendorPhone && <p className="text-muted-foreground">{order.vendorPhone}</p>}
            {order.vendorEmail && <p className="text-muted-foreground">{order.vendorEmail}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('schedule')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row(t('orderDate'), date(order.orderDate))}
            {row(t('expectedDate'), date(order.expectedDate))}
            {row(t('sentDate'), date(order.sentDate))}
            {row(t('receivedDate'), date(order.receivedDate))}
            {row(t('deliveredDate'), date(order.deliveredDate))}
            {row(t('estimatedCost'), formatCurrency(order.estimatedCost))}
            {row(
              t('actualCost'),
              order.actualCost == null ? '-' : formatCurrency(order.actualCost)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('quality')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row(t('qualityCheck'), order.qualityCheck || '-')}
            {order.qualityNotes && (
              <p className="py-2 text-sm whitespace-pre-wrap">{order.qualityNotes}</p>
            )}
            {order.notes && (
              <div className="py-2 text-sm">
                <p className="text-muted-foreground">{t('notes')}</p>
                <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
            {order.specialInstructions && (
              <div className="py-2 text-sm">
                <p className="text-muted-foreground">{t('specialInstructions')}</p>
                <p className="mt-1 whitespace-pre-wrap">{order.specialInstructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {order.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
          ) : (
            <ol className="space-y-3">
              {order.history.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <p className="font-medium">
                    {entry.statusFrom
                      ? `${statusLabel(entry.statusFrom)} → ${statusLabel(entry.statusTo)}`
                      : statusLabel(entry.statusTo)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDate(entry.createdAt)}
                    {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('documents')}</CardTitle>
        </CardHeader>
        <CardContent>
          {order.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
          ) : (
            <ul className="space-y-2">
              {order.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {doc.fileName}
                  </a>
                  <span className="text-muted-foreground">
                    {formatDate(doc.createdAt)}
                    {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
