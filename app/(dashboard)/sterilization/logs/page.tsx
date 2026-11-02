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
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, ClipboardList } from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

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
  const t = useTranslations('sterilization.logs')
  const tMethod = useTranslations('sterilization.method')
  const tResult = useTranslations('sterilization.result')
  const tCategory = useTranslations('sterilization.category')
  const { formatDateTime } = useClinicFormatters()
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
      toast({ title: t('errorTitle'), description: err.message, variant: 'destructive' })
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
        title: t('errorTitle'),
        description: t('requiredFields'),
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
      if (!res.ok) throw new Error((await res.json()).error || t('recordFailed'))
      toast({ title: t('successTitle'), description: t('recorded') })
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
      toast({ title: t('errorTitle'), description: err.message, variant: 'destructive' })
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
    return (
      <Badge variant={v[result] || 'secondary'}>
        {tResult.has(result) ? tResult(result) : result}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t('recordCycle')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('methodPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allMethods')}</SelectItem>
            {METHODS.map((mm) => (
              <SelectItem key={mm} value={mm}>
                {tMethod.has(mm) ? tMethod(mm) : mm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('resultPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allResults')}</SelectItem>
            {RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {tResult.has(r) ? tResult(r) : r}
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
            <h3 className="text-lg font-semibold">{t('noLogs')}</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">{t('noLogsHint')}</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> {t('recordCycle')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colInstrument')}</TableHead>
                  <TableHead>{t('colCycle')}</TableHead>
                  <TableHead>{t('colMethod')}</TableHead>
                  <TableHead>{t('colTempPressure')}</TableHead>
                  <TableHead>{t('colDuration')}</TableHead>
                  <TableHead>{t('colIndicators')}</TableHead>
                  <TableHead>{t('colResult')}</TableHead>
                  <TableHead>{t('colStarted')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.instrument.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tCategory.has(log.instrument.category)
                            ? tCategory(log.instrument.category)
                            : log.instrument.category}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>#{log.cycleNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tMethod.has(log.method) ? tMethod(log.method) : log.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.temperature ? t('tempC', { temp: log.temperature }) : '—'}
                      {log.pressure ? t('pressureBar', { pressure: log.pressure }) : ''}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.duration ? t('durationMin', { min: log.duration }) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {log.biologicalIndicator && (
                          <Badge variant="outline" className="text-xs">
                            {t('bio')}
                          </Badge>
                        )}
                        {log.chemicalIndicator && (
                          <Badge variant="outline" className="text-xs">
                            {t('chem')}
                          </Badge>
                        )}
                        {!log.biologicalIndicator && !log.chemicalIndicator && (
                          <span className="text-xs text-muted-foreground">{t('none')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{resultBadge(log.result)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(log.startedAt)}
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
            <DialogTitle>{t('recordDialogTitle')}</DialogTitle>
            <DialogDescription>{t('recordDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>{t('instrumentLabel')}</Label>
              <Select
                value={form.instrumentId}
                onValueChange={(v) => setForm({ ...form, instrumentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectInstrument')} />
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
                <Label>{t('methodLabel')}</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((mm) => (
                      <SelectItem key={mm} value={mm}>
                        {tMethod.has(mm) ? tMethod(mm) : mm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('machineIdLabel')}</Label>
                <Input
                  value={form.machineId}
                  onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                  placeholder={t('machineIdPlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('tempLabel')}</Label>
                <Input
                  type="number"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                  placeholder="134"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pressureLabel')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.pressure}
                  onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                  placeholder="2.1"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('durationLabel')}</Label>
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
                <Label>{t('startedLabel')}</Label>
                <Input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) => setForm({ ...form, startedAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('completedLabel')}</Label>
                <Input
                  type="datetime-local"
                  value={form.completedAt}
                  onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('resultLabel')}</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tResult.has(r) ? tResult(r) : r}
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
                <Label>{t('bioIndicator')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.chemicalIndicator}
                  onCheckedChange={(v) => setForm({ ...form, chemicalIndicator: v })}
                />
                <Label>{t('chemIndicator')}</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('notesLabel')}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleRecord} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('recordCycle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
