"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
} from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { downloadCSV } from "@/lib/export-utils"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { EmptyState } from "@/components/ui/empty-state"

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  user: { name: string; email: string; role: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  LOGIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  LOGOUT: "bg-muted text-muted-foreground",
  VIEW: "bg-muted text-muted-foreground",
}

const ENTITY_ICONS: Record<string, typeof Activity> = {
  User: UserCog,
  Patient: FileText,
  Appointment: Calendar,
  Invoice: CreditCard,
  default: Activity,
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [entityFilter, setEntityFilter] = useState<string>("all")
  const { toast } = useToast()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" })
      if (search) params.set("q", search)
      if (actionFilter !== "all") params.set("action", actionFilter)
      if (entityFilter !== "all") params.set("entity", entityFilter)
      const res = await fetch(`/api/audit-log?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch {
      toast({ title: "Error", description: "Failed to load audit logs", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, search, actionFilter, entityFilter, toast])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const exportLogs = () => {
    downloadCSV(
      logs.map((l) => ({
        Date: format(new Date(l.createdAt), "yyyy-MM-dd HH:mm:ss"),
        User: l.user?.name || "System",
        Role: l.user?.role || "-",
        Action: l.action,
        Entity: l.entityType,
        "Entity ID": l.entityId || "-",
        Details: l.details || "-",
        IP: l.ipAddress || "-",
      })),
      `audit-log-${format(new Date(), "yyyy-MM-dd")}`
    )
  }

  if (loading && logs.length === 0) return <TablePageSkeleton rows={8} cols={5} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Audit Log
          </h1>
          <p className="text-muted-foreground">{total.toLocaleString()} total events</p>
        </div>
        <Button variant="outline" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="LOGIN">Login</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="Patient">Patient</SelectItem>
            <SelectItem value="Appointment">Appointment</SelectItem>
            <SelectItem value="Invoice">Invoice</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="Treatment">Treatment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No audit logs found"
          description="No activity matches your current filters. Try adjusting your search criteria."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map((log) => {
                const Icon = ENTITY_ICONS[log.entityType] || ENTITY_ICONS.default
                return (
                  <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors">
                    <div className="rounded-full bg-muted p-2 mt-0.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.user?.name || "System"}</span>
                        <Badge variant="outline" className={ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}>
                          {log.action}
                        </Badge>
                        <Badge variant="outline">{log.entityType}</Badge>
                      </div>
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{log.details}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}</span>
                        {log.user?.role && <span>{log.user.role}</span>}
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
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
