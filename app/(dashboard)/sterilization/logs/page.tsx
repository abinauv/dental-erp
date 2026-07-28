'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, ClipboardList } from 'lucide-react'

const METHODS = ['AUTOCLAVE', 'CHEMICAL', 'DRY_HEAT', 'UV']
const RESULTS = ['PASS', 'FAIL', 'PENDING']

interface SterilizationLog {
  id: string
  cycleNumber: number
  method: string
  machineId: string | null
  temperature: number | null
  pressure: number | null
  duration: number | null
  operatorId: string
  result: string
  biologicalIndicator: boolean
  chemicalIndicator: boolean
  notes: string | null
  startedAt: string
  completedAt: string | null
  instrument: { id: string; name: string; category: string; serialNumber: string | null }
}

interface InstrumentOption {
  id: string
  name: string
  category: string
  serialNumber: string | null
}

export default function SterilizationLogsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<SterilizationLog[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [showDialog, setShowDialog] = useState(false)

  // Form
  const [form, setForm] = useState({
    instrumentId: '',
    method: 'AUTOCLAVE',
    machineId: '',
    temperature: '',
    pressure: '',
    duration: '',
    result: 'PASS',
    biologicalIndicator: false,
    chemicalIndicator: false,
    notes: '',
    startedAt: new Date().toISOString().slice(0, 16),
    completedAt: '',
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterMethod !== 'all') params.set('method', filterMethod)
      if (filterResult !== 'all') params.set('result', filterResult)

      const [logsRes, instrRes] = await Promise.all([
        fetch(`/api/sterilization/logs?${params}`),
        fetch('/api/sterilization/instruments'),
      ])
      if (!logsRes.ok) throw new Error('Failed to fetch logs')
      const logsData = await logsRes.json()
      setLogs(logsData.logs)

      if (instrRes.ok) {
        const instrData = await instrRes.json()
        setInstruments(instrData.instruments || [])
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filterMethod, filterResult])

  const handleRecord = async () => {
    if (!form.instrumentId || !form.method || !form.startedAt) {
      toast({
        title: 'Error',
        description: 'Instrument, method, and start time required',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/sterilization/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to record')
      toast({ title: 'Success', description: 'Sterilization cycle recorded' })
      setShowDialog(false)
      setForm({
        instrumentId: '',
        method: 'AUTOCLAVE',
        machineId: '',
        temperature: '',
        pressure: '',
        duration: '',
        result: 'PASS',
        biologicalIndicator: false,
        chemicalIndicator: false,
        notes: '',
        startedAt: new Date().toISOString().slice(0, 16),
        completedAt: '',
      })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const resultBadge = (result: string) => {
    const v: Record<string, 'default' | 'destructive' | 'secondary'> = {
      PASS: 'default',
      FAIL: 'destructive',
      PENDING: 'secondary',
    }
    return <Badge variant={v[result] || 'secondary'}>{result}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sterilization Logs</h2>
          <p className="text-muted-foreground">Record and view sterilization cycle history</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Record Cycle
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            {RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No sterilization logs</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Record your first sterilization cycle
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Record Cycle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Cycle #</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Temp/Pressure</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Indicators</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.instrument.name}</p>
                        <p className="text-xs text-muted-foreground">{log.instrument.category}</p>
                      </div>
                    </TableCell>
                    <TableCell>#{log.cycleNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.method}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.temperature ? `${log.temperature}°C` : '—'}
                      {log.pressure ? ` / ${log.pressure} bar` : ''}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.duration ? `${log.duration} min` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {log.biologicalIndicator && (
                          <Badge variant="outline" className="text-xs">
                            Bio
                          </Badge>
                        )}
                        {log.chemicalIndicator && (
                          <Badge variant="outline" className="text-xs">
                            Chem
                          </Badge>
                        )}
                        {!log.biologicalIndicator && !log.chemicalIndicator && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{resultBadge(log.result)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.startedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Record Cycle Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Record Sterilization Cycle</DialogTitle>
            <DialogDescription>Log a new sterilization process</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Instrument *</Label>
              <Select
                value={form.instrumentId}
                onValueChange={(v) => setForm({ ...form, instrumentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select instrument..." />
                </SelectTrigger>
                <SelectContent>
                  {instruments
                    .filter((i) => (i as any).status !== 'RETIRED')
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} ({i.category}){i.serialNumber ? ` - ${i.serialNumber}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method *</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Machine ID</Label>
                <Input
                  value={form.machineId}
                  onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                  placeholder="e.g., AC-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                  placeholder="134"
                />
              </div>
              <div className="space-y-2">
                <Label>Pressure (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.pressure}
                  onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                  placeholder="2.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="18"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Started At *</Label>
                <Input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) => setForm({ ...form, startedAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Completed At</Label>
                <Input
                  type="datetime-local"
                  value={form.completedAt}
                  onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Result</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.biologicalIndicator}
                  onCheckedChange={(v) => setForm({ ...form, biologicalIndicator: v })}
                />
                <Label>Biological Indicator</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.chemicalIndicator}
                  onCheckedChange={(v) => setForm({ ...form, chemicalIndicator: v })}
                />
                <Label>Chemical Indicator</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecord} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
