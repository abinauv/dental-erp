'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCog,
  FileText,
  CreditCard,
  Calendar,
  Download,
} from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { downloadCSV } from '@/lib/export-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { TablePageSkeleton } from '@/components/ui/page-skeleton'
import { EmptyState } from '@/components/ui/empty-state'

type Value = string | number | boolean | null
type Values = Record<string, Value>

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  entityLabel: string | null
  oldValues: Values | null
  newValues: Values | null
  details: string | null
  source: string | null
  ipAddress: string | null
  createdAt: string
  user: { name: string; email: string; role: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  LOGOUT: 'bg-muted text-muted-foreground',
  VIEW: 'bg-muted text-muted-foreground',
}

const ENTITY_ICONS: Record<string, typeof Activity> = {
  User: UserCog,
  Staff: UserCog,
  Patient: FileText,
  Appointment: Calendar,
  Invoice: CreditCard,
  Payment: CreditCard,
  default: Activity,
}

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'AI_INTERACTION', 'DATA_IMPORT']
// The records people look for most; search finds the rest.
const ENTITIES = [
  'Patient',
  'MedicalHistory',
  'Appointment',
  'Treatment',
  'TreatmentPlan',
  'Prescription',
  'Invoice',
  'Payment',
  'InsuranceClaim',
  'InventoryItem',
  'LabOrder',
  'Document',
  'Staff',
  'User',
  'Setting',
  'Hospital',
]

/** In a bulk change's values: how many records it touched (lib/audit-log COUNT_KEY). */
const COUNT_KEY = '$count'
const SHOWN_FIELDS = 3
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** "scheduledTime" → "Scheduled time". */
function fieldName(field: string): string {
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

interface Change {
  field: string
  from?: Value
  to?: Value
}

/** The fields an entry changed: old and new for an update, else one side. */
function changedFields(log: AuditEntry): Change[] {
  const from = log.oldValues ?? {}
  const to = log.newValues ?? {}
  const fields = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter(
    (field) => field !== COUNT_KEY
  )
  return fields.map((field) => ({
    field,
    ...(field in from ? { from: from[field] } : {}),
    ...(field in to ? { to: to[field] } : {}),
  }))
}

export default function AuditLogPage() {
  const t = useTranslations('auditLog')
  const tRole = useTranslations('staff.role')
  const { formatDate, formatDateTime, formatNumber } = useClinicFormatters()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (search) params.set('q', search)
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (entityFilter !== 'all') params.set('entity', entityFilter)
      const res = await fetch(`/api/audit-log?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch {
      toast({ title: t('errorTitle'), description: t('loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, search, actionFilter, entityFilter, toast, t])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const actionName = (action: string) =>
    t.has(`action.${action}`) ? t(`action.${action}`) : action
  const entityName = (entity: string) =>
    t.has(`entity.${entity}`) ? t(`entity.${entity}`) : fieldName(entity)
  const actorName = (log: AuditEntry) =>
    log.user?.name || (log.source === 'patient-portal' ? t('patientPortal') : t('systemUser'))

  const showValue = (value: Value | undefined): string => {
    if (value === null || value === undefined || value === '') return t('empty')
    if (typeof value === 'boolean') return value ? t('yes') : t('no')
    if (value === '[hidden]') return t('hidden')
    if (value === '[changed]') return t('changedValue')
    if (value === '[file]') return t('file')
    if (typeof value === 'string' && ISO_DATE.test(value)) {
      // A date column is stored as that day's midnight UTC.
      return value.endsWith('T00:00:00.000Z')
        ? formatDate(value, { timeZone: 'UTC' })
        : formatDateTime(value)
    }
    return String(value)
  }

  const describeChange = (change: Change) => {
    const name = fieldName(change.field)
    if ('from' in change && 'to' in change) {
      return `${name}: ${showValue(change.from)} → ${showValue(change.to)}`
    }
    return `${name}: ${showValue('to' in change ? change.to : change.from)}`
  }

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const exportLogs = () => {
    downloadCSV(
      logs.map((l) => {
        const count = l.newValues?.[COUNT_KEY]
        const changes = [
          ...(typeof count === 'number' ? [t('records', { count })] : []),
          ...changedFields(l).map(describeChange),
        ]
        return {
          [t('expDate')]: format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss'),
          [t('expUser')]: actorName(l),
          [t('expRole')]: l.user?.role || '-',
          [t('expAction')]: l.action,
          [t('expEntity')]: l.entityType,
          [t('expRecord')]: l.entityLabel || '-',
          [t('expEntityId')]: l.entityId || '-',
          [t('expDetails')]: l.details || changes.join('; ') || '-',
          [t('expSource')]: l.source || '-',
          [t('expIp')]: l.ipAddress || '-',
        }
      }),
      `audit-log-${format(new Date(), 'yyyy-MM-dd')}`
    )
  }

  if (loading && logs.length === 0) return <TablePageSkeleton rows={8} cols={5} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('totalEvents', { count: formatNumber(total) })}
          </p>
        </div>
        <Button variant="outline" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-2" /> {t('exportCsv')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('actionPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allActions')}</SelectItem>
            {ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {actionName(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={entityFilter}
          onValueChange={(v) => {
            setEntityFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('entityPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allEntities')}</SelectItem>
            {ENTITIES.map((entity) => (
              <SelectItem key={entity} value={entity}>
                {entityName(entity)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <EmptyState icon={Activity} title={t('noLogs')} description={t('noLogsDesc')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map((log) => {
                const Icon = ENTITY_ICONS[log.entityType] || ENTITY_ICONS.default
                const changes = changedFields(log)
                const isOpen = expanded.has(log.id)
                const shown = isOpen ? changes : changes.slice(0, SHOWN_FIELDS)
                const count = log.newValues?.[COUNT_KEY]
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="rounded-full bg-muted p-2 mt-0.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{actorName(log)}</span>
                        <Badge
                          variant="outline"
                          className={ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'}
                        >
                          {actionName(log.action)}
                        </Badge>
                        {/* A staff sign-in is about the person named first. */}
                        {!(log.action === 'LOGIN' && log.entityType === 'User' && log.user) && (
                          <>
                            <Badge variant="outline">{entityName(log.entityType)}</Badge>
                            {log.entityLabel && (
                              <span className="text-sm truncate">{log.entityLabel}</span>
                            )}
                          </>
                        )}
                        {typeof count === 'number' && (
                          <span className="text-sm text-muted-foreground">
                            {t('records', { count })}
                          </span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{log.details}</p>
                      )}
                      {shown.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                          {shown.map((change) => (
                            <li key={change.field} className="break-words">
                              {describeChange(change)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {changes.length > SHOWN_FIELDS && (
                        <button
                          type="button"
                          className="mt-1 text-xs font-medium text-primary hover:underline"
                          onClick={() => toggle(log.id)}
                        >
                          {isOpen ? t('showLess') : t('showAll', { count: changes.length })}
                        </button>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{formatDateTime(log.createdAt, { second: '2-digit' })}</span>
                        {log.user?.role && (
                          <span>
                            {tRole.has(log.user.role) ? tRole(log.user.role) : log.user.role}
                          </span>
                        )}
                        {log.source === 'mobile' && <span>{t('sourceMobile')}</span>}
                        {log.ipAddress && <span>{log.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('next')} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
