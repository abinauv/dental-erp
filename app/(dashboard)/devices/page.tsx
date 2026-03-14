"use client"

import { useState, useEffect, useCallback } from "react"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Wrench,
  Plus,
  Trash2,
  RefreshCw,
  Monitor,
  Activity,
  Cpu,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Device {
  id: string
  name: string
  type: string
  serialNumber: string | null
  location: string | null
  status: string
  lastPingAt: string | null
  ipAddress: string | null
  firmwareVersion: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  dataLogs: { id: string; data: Record<string, unknown>; eventType: string; timestamp: string }[]
}

interface DeviceSummary {
  total: number
  online: number
  offline: number
  error: number
  maintenance: number
}

const DEVICE_TYPES = [
  { value: "DENTAL_CHAIR", label: "Dental Chair" },
  { value: "PULSE_OXIMETER", label: "Pulse Oximeter" },
  { value: "BP_MONITOR", label: "BP Monitor" },
  { value: "AUTOCLAVE", label: "Autoclave" },
  { value: "XRAY", label: "X-Ray Machine" },
  { value: "COMPRESSOR", label: "Compressor" },
  { value: "SENSOR", label: "Sensor" },
  { value: "OTHER", label: "Other" },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
  ONLINE: { label: "Online", color: "bg-green-100 text-green-700", icon: Wifi },
  OFFLINE: { label: "Offline", color: "bg-muted text-muted-foreground", icon: WifiOff },
  ERROR: { label: "Error", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  MAINTENANCE: { label: "Maintenance", color: "bg-amber-100 text-amber-700", icon: Wrench },
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [summary, setSummary] = useState<DeviceSummary>({ total: 0, online: 0, offline: 0, error: 0, maintenance: 0 })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()

  // Form state
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState("")
  const [formSerial, setFormSerial] = useState("")
  const [formLocation, setFormLocation] = useState("")
  const [formIp, setFormIp] = useState("")

  const fetchDevices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== "all") params.set("type", filterType)
      if (filterStatus !== "all") params.set("status", filterStatus)

      const res = await fetch(`/api/devices/status?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDevices(data.devices || [])
      setSummary(data.summary || { total: 0, online: 0, offline: 0, error: 0, maintenance: 0 })
    } catch {
      toast({ title: "Error", description: "Failed to fetch devices", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, toast])

  useEffect(() => {
    fetchDevices()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDevices, 30000)
    return () => clearInterval(interval)
  }, [fetchDevices])

  const handleRegister = async () => {
    if (!formName || !formType) {
      toast({ title: "Error", description: "Name and type are required", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          type: formType,
          serialNumber: formSerial || undefined,
          location: formLocation || undefined,
          ipAddress: formIp || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast({ title: "Success", description: "Device registered successfully" })
      setDialogOpen(false)
      resetForm()
      fetchDevices()
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to register device",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Remove Device", description: "Remove this device? Data logs will also be deleted.", confirmLabel: "Remove" })
    if (!ok) return
    try {
      const res = await fetch(`/api/devices/status?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Success", description: "Device removed" })
      fetchDevices()
    } catch {
      toast({ title: "Error", description: "Failed to remove device", variant: "destructive" })
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/devices/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error()
      fetchDevices()
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setFormName("")
    setFormType("")
    setFormSerial("")
    setFormLocation("")
    setFormIp("")
  }

  const formatLastPing = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Device Management</h1>
          <p className="text-muted-foreground">Monitor and manage connected IoT devices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDevices}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Register Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Device</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Device Name *</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Chair Unit 1" />
                </div>
                <div>
                  <Label>Device Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {DEVICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Serial Number</Label>
                  <Input value={formSerial} onChange={(e) => setFormSerial(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="e.g. Operatory 1" />
                </div>
                <div>
                  <Label>IP Address</Label>
                  <Input value={formIp} onChange={(e) => setFormIp(e.target.value)} placeholder="e.g. 192.168.1.100" />
                </div>
                <Button className="w-full" onClick={handleRegister}>Register Device</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{summary.online}</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{summary.offline}</p>
                <p className="text-xs text-muted-foreground">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{summary.error}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{summary.maintenance}</p>
                <p className="text-xs text-muted-foreground">Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DEVICE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Device Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> Registered Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading devices...</p>
          ) : devices.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No devices registered. Click &quot;Register Device&quot; to add one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Ping</TableHead>
                  <TableHead>Latest Data</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const cfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.OFFLINE
                  const StatusIcon = cfg.icon
                  const lastLog = device.dataLogs?.[0]
                  return (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{device.name}</p>
                          {device.serialNumber && (
                            <p className="text-xs text-muted-foreground">S/N: {device.serialNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {DEVICE_TYPES.find((t) => t.value === device.type)?.label || device.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{device.location || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={device.status}
                          onValueChange={(val) => handleStatusChange(device.id, val)}
                        >
                          <SelectTrigger className="h-7 w-36">
                            <div className="flex items-center gap-1">
                              <StatusIcon className="h-3.5 w-3.5" />
                              <Badge className={`${cfg.color} text-xs`}>{cfg.label}</Badge>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONLINE">Online</SelectItem>
                            <SelectItem value="OFFLINE">Offline</SelectItem>
                            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                            <SelectItem value="ERROR">Error</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastPing(device.lastPingAt)}
                      </TableCell>
                      <TableCell>
                        {lastLog ? (
                          <div className="text-xs">
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3 text-blue-500" />
                              <span className="text-muted-foreground">
                                {lastLog.eventType || "READING"}
                              </span>
                            </div>
                            <p className="text-muted-foreground truncate max-w-[150px]">
                              {JSON.stringify(lastLog.data).slice(0, 50)}...
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDelete(device.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API Integration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Device Integration API</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Connected devices can push data using these endpoints:</p>
          <div className="bg-muted/50 p-3 rounded-md font-mono text-xs space-y-1">
            <p><span className="text-green-600 font-semibold">POST</span> /api/devices/register — Register new device</p>
            <p><span className="text-blue-600 font-semibold">POST</span> /api/devices/data — Push sensor readings</p>
            <p><span className="text-purple-600 font-semibold">GET</span> /api/devices/status — Get device statuses</p>
          </div>
          <p>
            Payload example for <code className="text-xs bg-muted px-1 rounded">/api/devices/data</code>:
          </p>
          <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto">
{`{
  "deviceId": "device_cuid_here",
  "data": {
    "heartRate": 72,
    "bp": "120/80",
    "spo2": 98,
    "temperature": 36.5
  },
  "eventType": "READING"
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
