'use client'

import { useState, useEffect, useCallback } from 'react'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Pill, Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react'

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Gel', 'Drops', 'Inhaler', 'Powder', 'Suspension', 'Spray']
const DEFAULT_CATEGORIES = ['Antibiotic', 'Analgesic', 'Anti-inflammatory', 'Antiseptic', 'Anesthetic', 'Antifungal', 'Antiviral', 'Vitamin', 'Steroid', 'Mouthwash', 'Other']

interface Medication {
  id: string
  name: string
  genericName: string | null
  category: string | null
  form: string | null
  strength: string | null
  manufacturer: string | null
  defaultDosage: string | null
  defaultFrequency: string | null
  defaultDuration: string | null
  contraindications: string | null
  sideEffects: string | null
  isActive: boolean
}

const emptyForm = {
  name: '', genericName: '', category: '', form: '', strength: '',
  manufacturer: '', defaultDosage: '', defaultFrequency: '', defaultDuration: '',
  contraindications: '', sideEffects: '',
}

export default function MedicationsPage() {
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [medications, setMedications] = useState<Medication[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 })

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchMedications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '50', active: 'true' })
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)

      const res = await fetch(`/api/medications?${params}`)
      const result = await res.json()
      if (result.success) {
        setMedications(result.data)
        setPagination(prev => ({ ...prev, total: result.pagination.total, pages: result.pagination.pages }))
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load medications' })
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, pagination.page])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/medications/categories')
      const result = await res.json()
      if (result.success && result.data.length > 0) {
        const merged = [...new Set([...DEFAULT_CATEGORIES, ...result.data])]
        setCategories(merged.sort())
      }
    } catch { /* use defaults */ }
  }

  useEffect(() => { fetchMedications() }, [fetchMedications])
  useEffect(() => { fetchCategories() }, [])

  const openAdd = () => {
    setEditing(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (med: Medication) => {
    setEditing(med)
    setFormData({
      name: med.name,
      genericName: med.genericName || '',
      category: med.category || '',
      form: med.form || '',
      strength: med.strength || '',
      manufacturer: med.manufacturer || '',
      defaultDosage: med.defaultDosage || '',
      defaultFrequency: med.defaultFrequency || '',
      defaultDuration: med.defaultDuration || '',
      contraindications: med.contraindications || '',
      sideEffects: med.sideEffects || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Medication name is required' })
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/medications/${editing.id}` : '/api/medications'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      toast({ title: editing ? 'Updated' : 'Created', description: `${formData.name} saved successfully` })
      setDialogOpen(false)
      fetchMedications()
      fetchCategories()
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (med: Medication) => {
    const ok = await confirm({ title: "Deactivate Medication", description: `Deactivate "${med.name}"? It will no longer appear in prescription search.`, confirmLabel: "Deactivate" })
    if (!ok) return
    try {
      const res = await fetch(`/api/medications/${med.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Deactivated', description: `${med.name} has been deactivated` })
      fetchMedications()
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to deactivate medication' })
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Pill className="h-8 w-8" />
            Drug Catalog
          </h1>
          <p className="text-muted-foreground">Manage your medication database</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Medication
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search medications..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPagination(p => ({ ...p, page: 1 })) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : medications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Pill className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No medications found</p>
              <p className="text-sm">Add your first medication to build your drug catalog.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Generic Name</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Form / Strength</TableHead>
                  <TableHead className="hidden lg:table-cell">Default Dosage</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map(med => (
                  <TableRow key={med.id}>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{med.genericName || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {med.category ? <Badge variant="secondary">{med.category}</Badge> : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {[med.form, med.strength].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {[med.defaultDosage, med.defaultFrequency, med.defaultDuration].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(med)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(med)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
            Next
          </Button>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Medication' : 'Add Medication'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update medication details' : 'Add a new medication to your catalog'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Medication Name *</Label>
                <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Amoxicillin" />
              </div>
              <div className="md:col-span-2">
                <Label>Generic Name</Label>
                <Input value={formData.genericName} onChange={e => setFormData(f => ({ ...f, genericName: e.target.value }))} placeholder="Amoxicillin Trihydrate" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category || undefined} onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Form</Label>
                <Select value={formData.form || undefined} onValueChange={v => setFormData(f => ({ ...f, form: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>
                    {FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Strength</Label>
                <Input value={formData.strength} onChange={e => setFormData(f => ({ ...f, strength: e.target.value }))} placeholder="500mg" />
              </div>
              <div>
                <Label>Manufacturer</Label>
                <Input value={formData.manufacturer} onChange={e => setFormData(f => ({ ...f, manufacturer: e.target.value }))} placeholder="Cipla" />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Default Prescription Values</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Dosage</Label>
                  <Input value={formData.defaultDosage} onChange={e => setFormData(f => ({ ...f, defaultDosage: e.target.value }))} placeholder="1 tablet" />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Input value={formData.defaultFrequency} onChange={e => setFormData(f => ({ ...f, defaultFrequency: e.target.value }))} placeholder="3 times a day" />
                </div>
                <div>
                  <Label>Duration</Label>
                  <Input value={formData.defaultDuration} onChange={e => setFormData(f => ({ ...f, defaultDuration: e.target.value }))} placeholder="5 days" />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid gap-4">
                <div>
                  <Label>Contraindications</Label>
                  <Textarea value={formData.contraindications} onChange={e => setFormData(f => ({ ...f, contraindications: e.target.value }))} placeholder="Known allergies, drug interactions..." rows={2} />
                </div>
                <div>
                  <Label>Side Effects</Label>
                  <Textarea value={formData.sideEffects} onChange={e => setFormData(f => ({ ...f, sideEffects: e.target.value }))} placeholder="Nausea, dizziness..." rows={2} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Update' : 'Add Medication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  )
}
