'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Loader2, Pencil, Trash2, Search, Package } from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

const CATEGORIES = [
  'Handpiece',
  'Scaler',
  'Mirror',
  'Probe',
  'Forceps',
  'Elevator',
  'Bur',
  'Clamp',
  'Scissors',
  'Retractor',
  'Suction',
  'Other',
]
const STATUSES = ['AVAILABLE', 'IN_USE', 'STERILIZING', 'CONTAMINATED', 'MAINTENANCE', 'RETIRED']

interface Instrument {
  id: string
  name: string
  category: string
  serialNumber: string | null
  rfidTag: string | null
  status: string
  location: string | null
  lastSterilizedAt: string | null
  sterilizationCycleCount: number
  maxCycles: number | null
  purchaseDate: string | null
  warrantyDate: string | null
  notes: string | null
  _count: { sterilizationLogs: number }
}

export default function InstrumentsPage() {
  const t = useTranslations('sterilization.instruments')
  const tStatus = useTranslations('sterilization.status')
  const tCategory = useTranslations('sterilization.category')
  const { formatDate } = useClinicFormatters()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: '',
    serialNumber: '',
    rfidTag: '',
    location: '',
    maxCycles: '',
    purchaseDate: '',
    warrantyDate: '',
    notes: '',
  })

  const fetchInstruments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterCategory !== 'all') params.set('category', filterCategory)

      const res = await fetch(`/api/sterilization/instruments?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInstruments(data.instruments)
    } catch (err: any) {
      toast({ title: t('errorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstruments()
  }, [filterStatus, filterCategory])

  const resetForm = () => {
    setForm({
      name: '',
      category: '',
      serialNumber: '',
      rfidTag: '',
      location: '',
      maxCycles: '',
      purchaseDate: '',
      warrantyDate: '',
      notes: '',
    })
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setShowDialog(true)
  }

  const openEdit = (inst: Instrument) => {
    setEditingId(inst.id)
    setForm({
      name: inst.name,
      category: inst.category,
      serialNumber: inst.serialNumber || '',
      rfidTag: inst.rfidTag || '',
      location: inst.location || '',
      maxCycles: inst.maxCycles?.toString() || '',
      purchaseDate: inst.purchaseDate ? inst.purchaseDate.split('T')[0] : '',
      warrantyDate: inst.warrantyDate ? inst.warrantyDate.split('T')[0] : '',
      notes: inst.notes || '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.category) {
      toast({
        title: t('errorTitle'),
        description: t('nameCategoryRequired'),
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId
        ? `/api/sterilization/instruments/${editingId}`
        : '/api/sterilization/instruments'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || t('saveFailed'))

      toast({
        title: t('successTitle'),
        description: editingId ? t('updated') : t('created'),
      })
      setShowDialog(false)
      resetForm()
      fetchInstruments()
    } catch (err: any) {
      toast({ title: t('errorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('deleteTitle'),
      description: t('deleteDesc'),
      confirmLabel: t('deleteConfirm'),
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/sterilization/instruments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setInstruments((prev) => prev.filter((i) => i.id !== id))
      toast({ title: t('successTitle'), description: t('deleted') })
    } catch (err: any) {
      toast({ title: t('errorTitle'), description: err.message, variant: 'destructive' })
    }
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      AVAILABLE: 'default',
      IN_USE: 'secondary',
      STERILIZING: 'secondary',
      CONTAMINATED: 'destructive',
      MAINTENANCE: 'outline',
      RETIRED: 'outline',
    }
    return (
      <Badge variant={variants[status] || 'outline'}>
        {tStatus.has(status) ? tStatus(status) : status}
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
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> {t('addInstrument')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInstruments()}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {tStatus.has(s) ? tStatus(s) : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('categoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {tCategory.has(c) ? tCategory(c) : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : instruments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('noInstruments')}</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">{t('noInstrumentsHint')}</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> {t('addInstrument')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colCategory')}</TableHead>
                  <TableHead>{t('colSerial')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colLocation')}</TableHead>
                  <TableHead className="text-right">{t('colCycles')}</TableHead>
                  <TableHead>{t('colLastSterilized')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>
                      {tCategory.has(inst.category) ? tCategory(inst.category) : inst.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inst.serialNumber || '—'}
                    </TableCell>
                    <TableCell>{statusBadge(inst.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{inst.location || '—'}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          inst.maxCycles && inst.sterilizationCycleCount >= inst.maxCycles * 0.9
                            ? 'text-red-600 font-semibold'
                            : ''
                        }
                      >
                        {inst.sterilizationCycleCount}
                        {inst.maxCycles ? `/${inst.maxCycles}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inst.lastSterilizedAt ? formatDate(inst.lastSterilizedAt) : t('never')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(inst)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDelete(inst.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editTitle') : t('addTitle')}</DialogTitle>
            <DialogDescription>{t('enterDetails')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('nameLabel')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('categoryLabel')}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectEllipsis')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {tCategory.has(c) ? tCategory(c) : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('serialLabel')}</Label>
                <Input
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('rfidLabel')}</Label>
                <Input
                  value={form.rfidTag}
                  onChange={(e) => setForm({ ...form, rfidTag: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('locationLabel')}</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder={t('locationPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('maxCyclesLabel')}</Label>
                <Input
                  type="number"
                  value={form.maxCycles}
                  onChange={(e) => setForm({ ...form, maxCycles: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('purchaseDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('warrantyLabel')}</Label>
                <Input
                  type="date"
                  value={form.warrantyDate}
                  onChange={(e) => setForm({ ...form, warrantyDate: e.target.value })}
                />
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
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? t('update') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  )
}
