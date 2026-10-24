'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit,
  BadgeCheck,
} from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface InsurancePolicy {
  id: string
  policyNumber: string
  groupNumber: string | null
  memberId: string
  subscriberName: string
  subscriberRelation: string
  effectiveDate: string
  expiryDate: string | null
  coverageType: string | null
  annualMaximum: string | number | null
  usedAmount: string | number | null
  remainingAmount: string | number | null
  deductible: string | number | null
  deductibleMet: boolean
  copayPercentage: string | number | null
  isActive: boolean
  lastVerifiedAt: string | null
  verificationStatus: string | null
  provider: {
    id: string
    name: string
    code: string | null
    contactPhone: string | null
  }
}

interface Provider {
  id: string
  name: string
}

const emptyForm = {
  providerId: '',
  policyNumber: '',
  groupNumber: '',
  memberId: '',
  subscriberName: '',
  subscriberRelation: 'Self',
  effectiveDate: '',
  expiryDate: '',
  coverageType: '',
  annualMaximum: '',
  deductible: '',
  copayPercentage: '',
}

export function PatientInsurance({ patientId }: { patientId: string }) {
  const { toast } = useToast()
  const t = useTranslations('insurance')
  const { formatCurrency, formatDate, currencySymbol } = useClinicFormatters()
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/insurance`)
      if (res.ok) setPolicies(await res.json())
    } catch {
      toast({ title: t('toast.loadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/insurance-providers?activeOnly=true')
      if (res.ok) setProviders(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchPolicies()
    fetchProviders()
  }, [patientId])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (p: InsurancePolicy) => {
    setEditingId(p.id)
    setForm({
      providerId: p.provider.id,
      policyNumber: p.policyNumber,
      groupNumber: p.groupNumber || '',
      memberId: p.memberId,
      subscriberName: p.subscriberName,
      subscriberRelation: p.subscriberRelation,
      effectiveDate: p.effectiveDate ? p.effectiveDate.split('T')[0] : '',
      expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '',
      coverageType: p.coverageType || '',
      annualMaximum: p.annualMaximum ? String(Number(p.annualMaximum)) : '',
      deductible: p.deductible ? String(Number(p.deductible)) : '',
      copayPercentage: p.copayPercentage ? String(Number(p.copayPercentage)) : '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (
      !form.providerId ||
      !form.policyNumber ||
      !form.memberId ||
      !form.subscriberName ||
      !form.effectiveDate
    ) {
      toast({ title: t('toast.fillRequired'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = `/api/patients/${patientId}/insurance`
      const method = editingId ? 'PUT' : 'POST'
      const payload = editingId ? { policyId: editingId, ...form } : form
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('toast.saveError'))
      }
      toast({ title: editingId ? t('toast.updated') : t('toast.added') })
      setDialogOpen(false)
      fetchPolicies()
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (policyId: string) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/insurance/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId }),
      })
      if (res.ok) {
        toast({ title: t('toast.verified') })
        fetchPolicies()
      }
    } catch {
      toast({ title: t('toast.verifyError'), variant: 'destructive' })
    }
  }

  const handleToggleActive = async (policyId: string, isActive: boolean) => {
    try {
      await fetch(`/api/patients/${patientId}/insurance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId, isActive: !isActive }),
      })
      toast({ title: isActive ? t('toast.deactivated') : t('toast.activated') })
      fetchPolicies()
    } catch {
      toast({ title: t('toast.updateError'), variant: 'destructive' })
    }
  }

  const getVerificationBadge = (p: InsurancePolicy) => {
    if (!p.verificationStatus) {
      return (
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" /> {t('verification.unverified')}
        </Badge>
      )
    }
    if (p.verificationStatus === 'VERIFIED') {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" /> {t('verification.verified')}
        </Badge>
      )
    }
    if (p.verificationStatus === 'EXPIRED') {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" /> {t('verification.expired')}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-xs">
        <Clock className="h-3 w-3 mr-1" /> {p.verificationStatus}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addPolicy')}
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="text-sm">{t('emptyDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((p) => (
            <Card key={p.id} className={!p.isActive ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      {p.provider.name}
                      {!p.isActive && <Badge variant="secondary">{t('inactive')}</Badge>}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('policyLine', { policy: p.policyNumber })}{' '}
                      {p.groupNumber && t('groupLine', { group: p.groupNumber })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getVerificationBadge(p)}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('memberId')}</p>
                    <p className="font-medium">{p.memberId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('subscriber')}</p>
                    <p className="font-medium">
                      {t('subscriberValue', {
                        name: p.subscriberName,
                        relation: t.has(`relation.${p.subscriberRelation}`)
                          ? t(`relation.${p.subscriberRelation}`)
                          : p.subscriberRelation,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('effective')}</p>
                    <p className="font-medium">{formatDate(p.effectiveDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('expires')}</p>
                    <p className="font-medium">
                      {p.expiryDate ? formatDate(p.expiryDate) : t('na')}
                    </p>
                  </div>
                </div>
                {(p.annualMaximum || p.deductible || p.copayPercentage) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t">
                    {p.annualMaximum && (
                      <div>
                        <p className="text-muted-foreground">{t('annualMaximum')}</p>
                        <p className="font-medium">{formatCurrency(Number(p.annualMaximum))}</p>
                      </div>
                    )}
                    {p.remainingAmount != null && (
                      <div>
                        <p className="text-muted-foreground">{t('remaining')}</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency(Number(p.remainingAmount))}
                        </p>
                      </div>
                    )}
                    {p.deductible != null && (
                      <div>
                        <p className="text-muted-foreground">{t('deductible')}</p>
                        <p className="font-medium">
                          {formatCurrency(Number(p.deductible))}
                          {p.deductibleMet && (
                            <span className="text-green-600 ml-1">{t('met')}</span>
                          )}
                        </p>
                      </div>
                    )}
                    {p.copayPercentage != null && (
                      <div>
                        <p className="text-muted-foreground">{t('copay')}</p>
                        <p className="font-medium">
                          {t('copayValue', { value: Number(p.copayPercentage) })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleVerify(p.id)}>
                    <BadgeCheck className="h-4 w-4 mr-1" />
                    {t('verify')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(p.id, p.isActive)}
                  >
                    {p.isActive ? (
                      <>
                        <XCircle className="h-4 w-4 mr-1" /> {t('deactivate')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" /> {t('activate')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Policy Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('dialog.providerLabel')}</Label>
              <Select
                value={form.providerId}
                onValueChange={(v) => setForm({ ...form, providerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('dialog.providerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('dialog.policyNumberLabel')}</Label>
                <Input
                  value={form.policyNumber}
                  onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                  placeholder={t('dialog.policyNumberPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('dialog.groupNumberLabel')}</Label>
                <Input
                  value={form.groupNumber}
                  onChange={(e) => setForm({ ...form, groupNumber: e.target.value })}
                  placeholder={t('dialog.groupNumberPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('dialog.memberIdLabel')}</Label>
                <Input
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  placeholder={t('dialog.memberIdPlaceholder')}
                />
              </div>
              <div>
                <Label>{t('dialog.relationLabel')}</Label>
                <Select
                  value={form.subscriberRelation}
                  onValueChange={(v) => setForm({ ...form, subscriberRelation: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Self', 'Spouse', 'Child', 'Parent', 'Other'].map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`relation.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>{t('dialog.subscriberNameLabel')}</Label>
                <Input
                  value={form.subscriberName}
                  onChange={(e) => setForm({ ...form, subscriberName: e.target.value })}
                  placeholder={t('dialog.subscriberNamePlaceholder')}
                />
              </div>
              <div>
                <Label>{t('dialog.effectiveDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('dialog.expiryDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('dialog.coverageTypeLabel')}</Label>
                <Select
                  value={form.coverageType}
                  onValueChange={(v) => setForm({ ...form, coverageType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialog.coverageTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">{t('coverageType.Individual')}</SelectItem>
                    <SelectItem value="Family">{t('coverageType.Family')}</SelectItem>
                    <SelectItem value="Group">{t('coverageType.Group')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('dialog.annualMaximumLabel')}</Label>
                <Input
                  type="number"
                  value={form.annualMaximum}
                  onChange={(e) => setForm({ ...form, annualMaximum: e.target.value })}
                  placeholder={currencySymbol}
                />
              </div>
              <div>
                <Label>{t('dialog.deductibleLabel')}</Label>
                <Input
                  type="number"
                  value={form.deductible}
                  onChange={(e) => setForm({ ...form, deductible: e.target.value })}
                  placeholder={currencySymbol}
                />
              </div>
              <div>
                <Label>{t('dialog.copayLabel')}</Label>
                <Input
                  type="number"
                  value={form.copayPercentage}
                  onChange={(e) => setForm({ ...form, copayPercentage: e.target.value })}
                  placeholder={t('dialog.copayPlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('dialog.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? t('dialog.saving')
                  : editingId
                    ? t('dialog.update')
                    : t('dialog.addPolicy')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
