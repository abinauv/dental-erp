'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
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
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Stethoscope,
  AlertCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { procedureCategoryConfig, formatCurrency } from '@/lib/treatment-utils'

interface Procedure {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  defaultDuration: number
  basePrice: string | number
  materials: string | null
  preInstructions: string | null
  postInstructions: string | null
  isActive: boolean
  _count?: {
    treatments: number
    treatmentPlanItems: number
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const categories = [
  'PREVENTIVE',
  'RESTORATIVE',
  'ENDODONTIC',
  'PERIODONTIC',
  'PROSTHODONTIC',
  'ORTHODONTIC',
  'ORAL_SURGERY',
  'COSMETIC',
  'DIAGNOSTIC',
  'EMERGENCY',
]

export default function ProceduresSettingsPage() {
  const t = useTranslations('settings.procedures')
  const tc = useTranslations('treatments.category')
  const { toast } = useToast()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    description: '',
    defaultDuration: '30',
    basePrice: '',
    materials: '',
    preInstructions: '',
    postInstructions: '',
    isActive: true,
  })

  // Category labels prefer the i18n catalogue, falling back to the config label.
  const categoryLabel = (cat: string) =>
    tc.has(cat) ? tc(cat) : procedureCategoryConfig[cat]?.label || cat

  const fetchProcedures = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append('search', search)
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter)
      if (activeFilter && activeFilter !== 'all') params.append('isActive', activeFilter)

      const response = await fetch(`/api/settings/procedures?${params}`)
      if (!response.ok) throw new Error(t('fetchFailed'))

      const data = await response.json()
      setProcedures(data.data || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching procedures:', error)
      toast({
        title: t('error'),
        description: t('fetchFailed'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProcedures()
  }, [pagination.page, search, categoryFilter, activeFilter])

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: '',
      description: '',
      defaultDuration: '30',
      basePrice: '',
      materials: '',
      preInstructions: '',
      postInstructions: '',
      isActive: true,
    })
    setError('')
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogMode('create')
    setDialogOpen(true)
  }

  const openEditDialog = (procedure: Procedure) => {
    setSelectedProcedure(procedure)
    setFormData({
      code: procedure.code,
      name: procedure.name,
      category: procedure.category,
      description: procedure.description || '',
      defaultDuration: procedure.defaultDuration.toString(),
      basePrice: procedure.basePrice.toString(),
      materials: procedure.materials || '',
      preInstructions: procedure.preInstructions || '',
      postInstructions: procedure.postInstructions || '',
      isActive: procedure.isActive,
    })
    setDialogMode('edit')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    setError('')

    // Validation
    if (dialogMode === 'create' && !formData.code) {
      setError(t('codeRequired'))
      return
    }

    if (!formData.name || !formData.category || !formData.basePrice) {
      setError(t('requiredFields'))
      return
    }

    setActionLoading(true)

    try {
      const url =
        dialogMode === 'create'
          ? '/api/settings/procedures'
          : `/api/settings/procedures/${selectedProcedure?.id}`

      const response = await fetch(url, {
        method: dialogMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          code: formData.code.toUpperCase(),
          defaultDuration: parseInt(formData.defaultDuration),
          basePrice: parseFloat(formData.basePrice),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('saveFailed'))
      }

      toast({
        title: t('success'),
        description: dialogMode === 'create' ? t('created') : t('updated'),
      })

      setDialogOpen(false)
      fetchProcedures()
    } catch (error: any) {
      setError(error.message)
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProcedure) return

    setActionLoading(true)

    try {
      const response = await fetch(`/api/settings/procedures/${selectedProcedure.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('deleteFailed'))
      }

      toast({
        title: t('success'),
        description: data.deactivated ? t('deactivated') : t('deleted'),
      })

      setDeleteDialogOpen(false)
      setSelectedProcedure(null)
      fetchProcedures()
    } catch (error: any) {
      setError(error.message)
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (procedure: Procedure) => {
    try {
      const response = await fetch(`/api/settings/procedures/${procedure.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !procedure.isActive }),
      })

      if (!response.ok) throw new Error(t('updateFailed'))

      toast({
        title: t('success'),
        description: !procedure.isActive ? t('statusActivated') : t('statusDeactivated'),
      })

      fetchProcedures()
    } catch (error: any) {
      console.error('Error updating procedure:', error)
      toast({
        title: t('error'),
        description: t('updateStatusFailed'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addProcedure')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allCategories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  <SelectItem value="true">{t('active')}</SelectItem>
                  <SelectItem value="false">{t('inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Procedures Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('colCode')}</TableHead>
                <TableHead>{t('colName')}</TableHead>
                <TableHead>{t('colCategory')}</TableHead>
                <TableHead>{t('colDuration')}</TableHead>
                <TableHead>{t('colPrice')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : procedures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Stethoscope className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">{t('noProcedures')}</p>
                      <Button variant="outline" size="sm" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addProcedure')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                procedures.map((procedure) => (
                  <TableRow key={procedure.id} className={!procedure.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-medium">{procedure.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{procedure.name}</div>
                      {procedure.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {procedure.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${procedureCategoryConfig[procedure.category]?.bgColor} ${procedureCategoryConfig[procedure.category]?.color} border-0`}
                      >
                        {categoryLabel(procedure.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>{t('durationMin', { count: procedure.defaultDuration })}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(procedure.basePrice)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={procedure.isActive}
                        onCheckedChange={() => handleToggleActive(procedure)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(procedure)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedProcedure(procedure)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? t('addDialogTitle') : t('editDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create' ? t('addDialogDesc') : t('editDialogDesc')}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">{t('codeLabel')}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder={t('codePlaceholder')}
                  maxLength={10}
                  disabled={dialogMode === 'edit'}
                  className="uppercase"
                />
                {dialogMode === 'edit' && (
                  <p className="text-xs text-muted-foreground">{t('codeCannotChange')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">{t('categoryLabel')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {categoryLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultDuration">{t('durationLabel')}</Label>
                <Input
                  id="defaultDuration"
                  type="number"
                  value={formData.defaultDuration}
                  onChange={(e) => setFormData({ ...formData, defaultDuration: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basePrice">{t('basePriceLabel')}</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  placeholder={t('basePricePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="materials">{t('materialsLabel')}</Label>
              <Textarea
                id="materials"
                value={formData.materials}
                onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                placeholder={t('materialsPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preInstructions">{t('preInstructionsLabel')}</Label>
              <Textarea
                id="preInstructions"
                value={formData.preInstructions}
                onChange={(e) => setFormData({ ...formData, preInstructions: e.target.value })}
                placeholder={t('preInstructionsPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postInstructions">{t('postInstructionsLabel')}</Label>
              <Textarea
                id="postInstructions"
                value={formData.postInstructions}
                onChange={(e) => setFormData({ ...formData, postInstructions: e.target.value })}
                placeholder={t('postInstructionsPlaceholder')}
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">{t('activeLabel')}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading}>
              {actionLoading
                ? t('saving')
                : dialogMode === 'create'
                  ? t('addProcedure')
                  : t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialogDesc', { name: selectedProcedure?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
