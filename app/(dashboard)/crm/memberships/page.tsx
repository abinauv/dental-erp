'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Crown,
  Users,
  UserPlus,
  X,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Benefit {
  description: string
  discountPercent?: number
}

interface MembershipPlan {
  id: string
  name: string
  description: string | null
  price: number
  durationMonths: number
  benefits: Benefit[]
  maxMembers: number | null
  isActive: boolean
  _count: { memberships: number }
}

interface PatientSearchResult {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
}

interface Membership {
  id: string
  startDate: string
  endDate: string
  autoRenew: boolean
  status: string
  patient: {
    id: string
    firstName: string
    lastName: string
    phone: string | null
    email: string | null
  }
}

// ── Empty form state ───────────────────────────────────────────────────────────

const emptyPlanForm = {
  name: '',
  description: '',
  price: '',
  durationMonths: '12',
  benefits: [{ description: '', discountPercent: undefined }] as Benefit[],
  maxMembers: '',
  isActive: true,
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MembershipPlansPage() {
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const t = useTranslations('crm.memberships')
  const { formatCurrency, formatDate, currencySymbol } = useClinicFormatters()

  // Plan list state
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)

  // Create / Edit dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planForm, setPlanForm] = useState(emptyPlanForm)
  const [savingPlan, setSavingPlan] = useState(false)

  // Enroll dialog
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false)
  const [enrollPlanId, setEnrollPlanId] = useState<string | null>(null)
  const [enrollPlanName, setEnrollPlanName] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null)
  const [autoRenew, setAutoRenew] = useState(true)
  const [enrolling, setEnrolling] = useState(false)

  // Plan detail view
  const [detailPlan, setDetailPlan] = useState<MembershipPlan | null>(null)
  const [detailMembers, setDetailMembers] = useState<Membership[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Debounce ref for patient search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch plans ────────────────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/memberships/plans')
      if (!res.ok) throw new Error('Failed to fetch plans')
      const data = await res.json()
      setPlans(data)
    } catch {
      toast({ title: t('toast.loadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  // ── Plan CRUD ──────────────────────────────────────────────────────────────

  const openCreatePlan = () => {
    setEditingPlanId(null)
    setPlanForm({ ...emptyPlanForm, benefits: [{ description: '', discountPercent: undefined }] })
    setPlanDialogOpen(true)
  }

  const openEditPlan = (plan: MembershipPlan) => {
    setEditingPlanId(plan.id)
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      price: String(plan.price),
      durationMonths: String(plan.durationMonths),
      benefits:
        plan.benefits.length > 0
          ? plan.benefits.map((b) => ({ ...b }))
          : [{ description: '', discountPercent: undefined }],
      maxMembers: plan.maxMembers ? String(plan.maxMembers) : '',
      isActive: plan.isActive,
    })
    setPlanDialogOpen(true)
  }

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast({ title: t('toast.nameRequired'), variant: 'destructive' })
      return
    }
    if (!planForm.price || Number(planForm.price) <= 0) {
      toast({ title: t('toast.priceInvalid'), variant: 'destructive' })
      return
    }
    if (!planForm.durationMonths || Number(planForm.durationMonths) <= 0) {
      toast({ title: t('toast.durationInvalid'), variant: 'destructive' })
      return
    }

    setSavingPlan(true)
    try {
      const filteredBenefits = planForm.benefits.filter((b) => b.description.trim() !== '')
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        price: Number(planForm.price),
        durationMonths: Number(planForm.durationMonths),
        benefits: filteredBenefits,
        maxMembers: planForm.maxMembers ? Number(planForm.maxMembers) : null,
        isActive: planForm.isActive,
      }

      const url = editingPlanId
        ? `/api/memberships/plans/${editingPlanId}`
        : '/api/memberships/plans'
      const res = await fetch(url, {
        method: editingPlanId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('toast.saveError'))
      }

      toast({ title: editingPlanId ? t('toast.updated') : t('toast.created') })
      setPlanDialogOpen(false)
      fetchPlans()
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setSavingPlan(false)
    }
  }

  const handleDeletePlan = async (id: string) => {
    const ok = await confirm({
      title: t('toast.deleteConfirmTitle'),
      description: t('toast.deleteConfirmDescription'),
      confirmLabel: t('toast.deleteConfirmLabel'),
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/memberships/plans/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('toast.deleteError'))
      }
      toast({ title: t('toast.deleted') })
      if (detailPlan?.id === id) setDetailPlan(null)
      fetchPlans()
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    }
  }

  // ── Benefits management ────────────────────────────────────────────────────

  const addBenefit = () => {
    setPlanForm((prev) => ({
      ...prev,
      benefits: [...prev.benefits, { description: '', discountPercent: undefined }],
    }))
  }

  const removeBenefit = (index: number) => {
    setPlanForm((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index),
    }))
  }

  const updateBenefit = (index: number, field: keyof Benefit, value: string) => {
    setPlanForm((prev) => {
      const updated = [...prev.benefits]
      if (field === 'description') {
        updated[index] = { ...updated[index], description: value }
      } else if (field === 'discountPercent') {
        updated[index] = {
          ...updated[index],
          discountPercent: value ? Number(value) : undefined,
        }
      }
      return { ...prev, benefits: updated }
    })
  }

  // ── Enroll Patient ─────────────────────────────────────────────────────────

  const openEnrollDialog = (plan: MembershipPlan) => {
    setEnrollPlanId(plan.id)
    setEnrollPlanName(plan.name)
    setPatientSearch('')
    setPatientResults([])
    setSelectedPatient(null)
    setAutoRenew(true)
    setEnrollDialogOpen(true)
  }

  const handlePatientSearchChange = (value: string) => {
    setPatientSearch(value)
    setSelectedPatient(null)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (value.trim().length < 2) {
      setPatientResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingPatients(true)
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(value.trim())}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          // API may return { patients: [...] } or just [...]
          setPatientResults(Array.isArray(data) ? data : data.patients || [])
        }
      } catch {
        // Silently fail search
      } finally {
        setSearchingPatients(false)
      }
    }, 400)
  }

  const selectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient)
    setPatientSearch(`${patient.firstName} ${patient.lastName}`)
    setPatientResults([])
  }

  const handleEnroll = async () => {
    if (!selectedPatient || !enrollPlanId) {
      toast({ title: t('toast.selectPatient'), variant: 'destructive' })
      return
    }

    setEnrolling(true)
    try {
      const res = await fetch('/api/memberships/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: enrollPlanId,
          patientId: selectedPatient.id,
          autoRenew,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('toast.enrollError'))
      }

      toast({
        title: t('toast.enrolled', {
          name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        }),
      })
      setEnrollDialogOpen(false)
      fetchPlans()
      // Refresh detail view if open
      if (detailPlan?.id === enrollPlanId) {
        fetchPlanDetail(enrollPlanId)
      }
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setEnrolling(false)
    }
  }

  // ── Plan Detail View ───────────────────────────────────────────────────────

  const fetchPlanDetail = async (planId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/memberships/enroll?planId=${planId}`)
      if (!res.ok) throw new Error('Failed to load members')
      const data = await res.json()
      setDetailMembers(Array.isArray(data) ? data : data.memberships || [])
    } catch {
      toast({ title: t('toast.membersLoadError'), variant: 'destructive' })
    } finally {
      setLoadingDetail(false)
    }
  }

  const openPlanDetail = (plan: MembershipPlan) => {
    setDetailPlan(plan)
    fetchPlanDetail(plan.id)
  }

  const closePlanDetail = () => {
    setDetailPlan(null)
    setDetailMembers([])
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDuration = (months: number) => {
    if (months === 1) return t('duration.oneMonth')
    if (months === 12) return t('duration.oneYear')
    if (months % 12 === 0) return t('duration.years', { count: months / 12 })
    return t('duration.months', { count: months })
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Plan Detail View ───────────────────────────────────────────────────────

  if (detailPlan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={closePlanDetail}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              {detailPlan.name}
            </h1>
            <p className="text-muted-foreground">
              {formatCurrency(detailPlan.price)} / {formatDuration(detailPlan.durationMonths)}
              {' \u2022 '}
              {detailPlan._count.memberships}{' '}
              {detailPlan._count.memberships === 1 ? t('member') : t('members')}
            </p>
          </div>
          <Button onClick={() => openEnrollDialog(detailPlan)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('detail.enrollPatient')}
          </Button>
        </div>

        {/* Benefits */}
        {detailPlan.benefits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t('detail.planBenefits')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {detailPlan.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>
                      {b.description}
                      {b.discountPercent ? (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {t('benefitOffBadge', { percent: b.discountPercent })}
                        </Badge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('detail.enrolledPatients')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : detailMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">{t('detail.noMembersTitle')}</p>
                <p className="text-sm">{t('detail.noMembersDescription')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('detail.colPatient')}</TableHead>
                    <TableHead>{t('detail.colContact')}</TableHead>
                    <TableHead>{t('detail.colStartDate')}</TableHead>
                    <TableHead>{t('detail.colEndDate')}</TableHead>
                    <TableHead>{t('detail.colAutoRenew')}</TableHead>
                    <TableHead>{t('detail.colStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.patient.firstName} {m.patient.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.patient.phone || m.patient.email || '\u2014'}
                      </TableCell>
                      <TableCell>{formatDate(m.startDate)}</TableCell>
                      <TableCell>{formatDate(m.endDate)}</TableCell>
                      <TableCell>
                        <Badge variant={m.autoRenew ? 'default' : 'secondary'}>
                          {m.autoRenew ? t('detail.yes') : t('detail.no')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.status === 'ACTIVE'
                              ? 'default'
                              : m.status === 'EXPIRED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {t.has(`status.${m.status}`) ? t(`status.${m.status}`) : m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main View: Plan Grid ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreatePlan}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newPlan')}
        </Button>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <Crown className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-lg">{t('emptyTitle')}</p>
              <p className="text-sm mb-4">{t('emptyDescription')}</p>
              <Button onClick={openCreatePlan}>
                <Plus className="h-4 w-4 mr-2" />
                {t('createFirstPlan')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative cursor-pointer transition-shadow hover:shadow-md ${
                !plan.isActive ? 'opacity-60' : ''
              }`}
              onClick={() => openPlanDetail(plan)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                      {plan.isActive ? t('active') : t('inactive')}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditPlan(plan)}>
                          <Edit className="h-4 w-4 mr-2" /> {t('dialog.editTitle')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEnrollDialog(plan)}>
                          <UserPlus className="h-4 w-4 mr-2" /> {t('detail.enrollPatient')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeletePlan(plan.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> {t('toast.deleteConfirmLabel')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Price & Duration */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{formatCurrency(plan.price)}</span>
                  <span className="text-sm text-muted-foreground">
                    / {formatDuration(plan.durationMonths)}
                  </span>
                </div>

                {/* Member Count */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {plan._count.memberships}{' '}
                    {plan._count.memberships === 1 ? t('member') : t('members')}
                    {plan.maxMembers ? t('maxSuffix', { max: plan.maxMembers }) : ''}
                  </span>
                </div>

                {/* Benefits Preview */}
                {plan.benefits.length > 0 && (
                  <div className="border-t pt-3 space-y-1.5">
                    {plan.benefits.slice(0, 3).map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground line-clamp-1">
                          {b.description}
                          {b.discountPercent
                            ? ` ${t('benefitOffInline', { percent: b.discountPercent })}`
                            : ''}
                        </span>
                      </div>
                    ))}
                    {plan.benefits.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-5">
                        {plan.benefits.length - 3 > 1
                          ? t('moreBenefits', { count: plan.benefits.length - 3 })
                          : t('moreBenefit', { count: plan.benefits.length - 3 })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Plan Dialog ──────────────────────────────────────── */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlanId ? t('dialog.editTitle') : t('dialog.createTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label>{t('dialog.nameLabel')}</Label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder={t('dialog.namePlaceholder')}
              />
            </div>

            {/* Description */}
            <div>
              <Label>{t('dialog.descriptionLabel')}</Label>
              <Textarea
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder={t('dialog.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            {/* Price & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('dialog.priceLabel', { symbol: currencySymbol })}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  placeholder={t('dialog.pricePlaceholder')}
                />
              </div>
              <div>
                <Label>{t('dialog.durationLabel')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={planForm.durationMonths}
                  onChange={(e) => setPlanForm({ ...planForm, durationMonths: e.target.value })}
                  placeholder={t('dialog.durationPlaceholder')}
                />
              </div>
            </div>

            {/* Max Members */}
            <div>
              <Label>{t('dialog.maxMembersLabel')}</Label>
              <Input
                type="number"
                min="1"
                value={planForm.maxMembers}
                onChange={(e) => setPlanForm({ ...planForm, maxMembers: e.target.value })}
                placeholder={t('dialog.maxMembersPlaceholder')}
              />
            </div>

            {/* Benefits */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('dialog.benefitsLabel')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBenefit}>
                  <Plus className="h-3 w-3 mr-1" /> {t('dialog.addBenefit')}
                </Button>
              </div>
              <div className="space-y-2">
                {planForm.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Input
                        value={benefit.description}
                        onChange={(e) => updateBenefit(index, 'description', e.target.value)}
                        placeholder={t('dialog.benefitPlaceholder')}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={benefit.discountPercent ?? ''}
                        onChange={(e) => updateBenefit(index, 'discountPercent', e.target.value)}
                        placeholder={t('dialog.percentOffPlaceholder')}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeBenefit(index)}
                      disabled={planForm.benefits.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('dialog.benefitsHint')}</p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">{t('dialog.activeLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('dialog.activeHint')}</p>
              </div>
              <Switch
                checked={planForm.isActive}
                onCheckedChange={(checked) => setPlanForm({ ...planForm, isActive: checked })}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
                {t('dialog.cancel')}
              </Button>
              <Button onClick={handleSavePlan} disabled={savingPlan}>
                {savingPlan
                  ? t('dialog.saving')
                  : editingPlanId
                    ? t('dialog.updatePlan')
                    : t('dialog.createPlan')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Enroll Patient Dialog ──────────────────────────────────────────── */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('enroll.title', { plan: enrollPlanName })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Patient Search */}
            <div>
              <Label>{t('enroll.searchLabel')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={patientSearch}
                  onChange={(e) => handlePatientSearchChange(e.target.value)}
                  placeholder={t('enroll.searchPlaceholder')}
                  className="pl-9"
                />
              </div>

              {/* Search Results Dropdown */}
              {(patientResults.length > 0 || searchingPatients) && !selectedPatient && (
                <div className="border rounded-md mt-1 bg-background shadow-sm max-h-48 overflow-y-auto">
                  {searchingPatients ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      {t('enroll.searching')}
                    </div>
                  ) : (
                    patientResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm transition-colors"
                        onClick={() => selectPatient(p)}
                      >
                        <div className="font-medium">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.phone || p.email || t('enroll.noContact')}
                        </div>
                      </button>
                    ))
                  )}
                  {!searchingPatients &&
                    patientResults.length === 0 &&
                    patientSearch.length >= 2 && (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        {t('enroll.noPatients')}
                      </div>
                    )}
                </div>
              )}

              {/* Selected Patient Chip */}
              {selectedPatient && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedPatient(null)
                      setPatientSearch('')
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Auto-Renew Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">{t('enroll.autoRenewLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('enroll.autoRenewHint')}</p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                {t('enroll.cancel')}
              </Button>
              <Button onClick={handleEnroll} disabled={enrolling || !selectedPatient}>
                {enrolling ? t('enroll.enrolling') : t('enroll.submit')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  )
}
