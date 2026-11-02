'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Gift, Plus, Minus, Search, TrendingUp, Star, ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Patient {
  id: string
  firstName: string
  lastName: string
  phone: string
}

interface LoyaltyTransaction {
  id: string
  patientId: string
  patient?: { firstName: string; lastName: string }
  points: number
  type: string
  description: string
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type PointType = 'VISIT' | 'REFERRAL' | 'TREATMENT' | 'BIRTHDAY' | 'SIGNUP' | 'REDEMPTION'

// Values only — the display labels live in the `crm.loyalty.type` catalogue,
// resolved at render. REDEMPTION is awarded only via the redeem action, so it
// is absent from the award list but present in the log filter.
const AWARD_TYPE_VALUES: PointType[] = ['VISIT', 'REFERRAL', 'TREATMENT', 'BIRTHDAY', 'SIGNUP']

const FILTER_TYPE_VALUES: (PointType | 'ALL')[] = [
  'ALL',
  'VISIT',
  'REFERRAL',
  'TREATMENT',
  'BIRTHDAY',
  'SIGNUP',
  'REDEMPTION',
]

const TYPE_BADGE_COLORS: Record<string, string> = {
  VISIT: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  REFERRAL: 'bg-green-100 text-green-800 hover:bg-green-100',
  TREATMENT: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  REDEMPTION: 'bg-red-100 text-red-800 hover:bg-red-100',
  BIRTHDAY: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  SIGNUP: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100',
}

// ---------------------------------------------------------------------------
// Patient Search Hook (debounced)
// ---------------------------------------------------------------------------

function usePatientSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((value: string) => {
    setQuery(value)
    setShowDropdown(true)

    if (timerRef.current) clearTimeout(timerRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(value.trim())}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          const patients = Array.isArray(data) ? data : (data.patients ?? [])
          setResults(patients)
        }
      } catch {
        // silently ignore search errors
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }, [])

  return { query, results, searching, showDropdown, setShowDropdown, search, clear }
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function LoyaltyPage() {
  const { toast } = useToast()
  const t = useTranslations('crm.loyalty')
  const { formatNumber, formatDate } = useClinicFormatters()

  // ---- Award state ----
  const awardSearch = usePatientSearch()
  const [awardPatient, setAwardPatient] = useState<Patient | null>(null)
  const [awardBalance, setAwardBalance] = useState<number | null>(null)
  const [awardPoints, setAwardPoints] = useState('')
  const [awardType, setAwardType] = useState<PointType>('VISIT')
  const [awardDesc, setAwardDesc] = useState('')
  const [awardSubmitting, setAwardSubmitting] = useState(false)

  // ---- Redeem state ----
  const redeemSearch = usePatientSearch()
  const [redeemPatient, setRedeemPatient] = useState<Patient | null>(null)
  const [redeemBalance, setRedeemBalance] = useState<number | null>(null)
  const [redeemPoints, setRedeemPoints] = useState('')
  const [redeemDesc, setRedeemDesc] = useState('')
  const [redeemSubmitting, setRedeemSubmitting] = useState(false)

  // ---- Transaction log state ----
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [filterType, setFilterType] = useState<PointType | 'ALL'>('ALL')
  const [logLoading, setLogLoading] = useState(true)

  // -------------------------------------------------------------------
  // Fetch patient balance
  // -------------------------------------------------------------------
  const fetchBalance = useCallback(async (patientId: string): Promise<number> => {
    try {
      const res = await fetch(`/api/loyalty?patientId=${patientId}`)
      if (!res.ok) return 0
      const data = await res.json()
      return data.balance ?? 0
    } catch {
      return 0
    }
  }, [])

  // -------------------------------------------------------------------
  // Select patient for Award
  // -------------------------------------------------------------------
  const selectAwardPatient = useCallback(
    async (patient: Patient) => {
      setAwardPatient(patient)
      awardSearch.setShowDropdown(false)
      awardSearch.search('')
      const bal = await fetchBalance(patient.id)
      setAwardBalance(bal)
    },
    [awardSearch, fetchBalance]
  )

  // -------------------------------------------------------------------
  // Select patient for Redeem
  // -------------------------------------------------------------------
  const selectRedeemPatient = useCallback(
    async (patient: Patient) => {
      setRedeemPatient(patient)
      redeemSearch.setShowDropdown(false)
      redeemSearch.search('')
      const bal = await fetchBalance(patient.id)
      setRedeemBalance(bal)
    },
    [redeemSearch, fetchBalance]
  )

  // -------------------------------------------------------------------
  // Fetch transaction log
  // -------------------------------------------------------------------
  const fetchTransactions = useCallback(
    async (page: number = 1) => {
      setLogLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' })
        if (filterType !== 'ALL') params.set('type', filterType)
        const res = await fetch(`/api/loyalty?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setTransactions(data.transactions ?? [])
        setPagination(data.pagination ?? { page, limit: 20, total: 0, totalPages: 0 })
      } catch {
        toast({ title: t('toast.loadError'), variant: 'destructive' })
      } finally {
        setLogLoading(false)
      }
    },
    [filterType, toast, t]
  )

  useEffect(() => {
    fetchTransactions(1)
  }, [fetchTransactions])

  // -------------------------------------------------------------------
  // Award submit
  // -------------------------------------------------------------------
  async function handleAward(e: React.FormEvent) {
    e.preventDefault()
    if (!awardPatient) {
      toast({ title: t('toast.selectPatient'), variant: 'destructive' })
      return
    }
    const pts = parseInt(awardPoints)
    if (!pts || pts <= 0) {
      toast({ title: t('toast.pointsPositive'), variant: 'destructive' })
      return
    }

    setAwardSubmitting(true)
    try {
      const res = await fetch('/api/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: awardPatient.id,
          points: pts,
          type: awardType,
          description: awardDesc || t('award.defaultDescription', { type: t(`type.${awardType}`) }),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || t('toast.awardError'))
      }

      toast({
        title: t('toast.awarded', {
          pts,
          name: `${awardPatient.firstName} ${awardPatient.lastName}`,
        }),
      })

      // Reset form
      setAwardPatient(null)
      setAwardBalance(null)
      setAwardPoints('')
      setAwardType('VISIT')
      setAwardDesc('')
      awardSearch.clear()

      // Refresh log
      fetchTransactions(1)
    } catch (error: any) {
      toast({ title: error.message || t('toast.awardError'), variant: 'destructive' })
    } finally {
      setAwardSubmitting(false)
    }
  }

  // -------------------------------------------------------------------
  // Redeem submit
  // -------------------------------------------------------------------
  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    if (!redeemPatient) {
      toast({ title: t('toast.selectPatient'), variant: 'destructive' })
      return
    }
    const pts = parseInt(redeemPoints)
    if (!pts || pts <= 0) {
      toast({ title: t('toast.pointsPositive'), variant: 'destructive' })
      return
    }
    if (redeemBalance !== null && pts > redeemBalance) {
      toast({ title: t('toast.insufficient'), variant: 'destructive' })
      return
    }

    setRedeemSubmitting(true)
    try {
      const res = await fetch('/api/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: redeemPatient.id,
          points: -pts,
          type: 'REDEMPTION',
          description: redeemDesc || t('redeem.defaultDescription'),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || t('toast.redeemError'))
      }

      toast({
        title: t('toast.redeemed', {
          pts,
          name: `${redeemPatient.firstName} ${redeemPatient.lastName}`,
        }),
      })

      // Reset form
      setRedeemPatient(null)
      setRedeemBalance(null)
      setRedeemPoints('')
      setRedeemDesc('')
      redeemSearch.clear()

      // Refresh log
      fetchTransactions(1)
    } catch (error: any) {
      toast({ title: error.message || t('toast.redeemError'), variant: 'destructive' })
    } finally {
      setRedeemSubmitting(false)
    }
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="h-7 w-7 text-purple-500" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Award & Redeem side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============ AWARD POINTS ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              {t('award.title')}
            </CardTitle>
            <CardDescription>{t('award.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAward} className="space-y-4">
              {/* Patient search */}
              <div className="space-y-2">
                <Label>{t('award.patientLabel')}</Label>
                {awardPatient ? (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">
                        {awardPatient.firstName} {awardPatient.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{awardPatient.phone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {awardBalance !== null && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('award.balance')}</p>
                          <p className="font-bold text-lg flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            {formatNumber(awardBalance)}
                          </p>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAwardPatient(null)
                          setAwardBalance(null)
                          awardSearch.clear()
                        }}
                      >
                        {t('award.change')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('award.searchPlaceholder')}
                      value={awardSearch.query}
                      onChange={(e) => awardSearch.search(e.target.value)}
                      onFocus={() => {
                        if (awardSearch.results.length > 0) awardSearch.setShowDropdown(true)
                      }}
                      className="pl-9"
                    />
                    {awardSearch.showDropdown &&
                      (awardSearch.results.length > 0 || awardSearch.searching) && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                          {awardSearch.searching ? (
                            <div className="p-3 text-sm text-muted-foreground">
                              {t('award.searching')}
                            </div>
                          ) : (
                            awardSearch.results.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent text-sm"
                                onClick={() => selectAwardPatient(p)}
                              >
                                <span className="font-medium">
                                  {p.firstName} {p.lastName}
                                </span>
                                <span className="text-muted-foreground">{p.phone}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Points */}
              <div className="space-y-2">
                <Label htmlFor="awardPoints">{t('award.pointsLabel')}</Label>
                <Input
                  id="awardPoints"
                  type="number"
                  min="1"
                  placeholder={t('award.pointsPlaceholder')}
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(e.target.value)}
                  required
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>{t('award.typeLabel')}</Label>
                <Select value={awardType} onValueChange={(v) => setAwardType(v as PointType)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('award.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {AWARD_TYPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`type.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="awardDesc">{t('award.descriptionLabel')}</Label>
                <Input
                  id="awardDesc"
                  placeholder={t('award.descriptionPlaceholder')}
                  value={awardDesc}
                  onChange={(e) => setAwardDesc(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={awardSubmitting || !awardPatient}>
                {awardSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('award.submitting')}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('award.submit')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ============ REDEEM POINTS ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-red-600" />
              {t('redeem.title')}
            </CardTitle>
            <CardDescription>{t('redeem.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRedeem} className="space-y-4">
              {/* Patient search */}
              <div className="space-y-2">
                <Label>{t('award.patientLabel')}</Label>
                {redeemPatient ? (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">
                        {redeemPatient.firstName} {redeemPatient.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{redeemPatient.phone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {redeemBalance !== null && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('award.balance')}</p>
                          <p className="font-bold text-lg flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            {formatNumber(redeemBalance)}
                          </p>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRedeemPatient(null)
                          setRedeemBalance(null)
                          redeemSearch.clear()
                        }}
                      >
                        {t('award.change')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('award.searchPlaceholder')}
                      value={redeemSearch.query}
                      onChange={(e) => redeemSearch.search(e.target.value)}
                      onFocus={() => {
                        if (redeemSearch.results.length > 0) redeemSearch.setShowDropdown(true)
                      }}
                      className="pl-9"
                    />
                    {redeemSearch.showDropdown &&
                      (redeemSearch.results.length > 0 || redeemSearch.searching) && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                          {redeemSearch.searching ? (
                            <div className="p-3 text-sm text-muted-foreground">
                              {t('award.searching')}
                            </div>
                          ) : (
                            redeemSearch.results.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent text-sm"
                                onClick={() => selectRedeemPatient(p)}
                              >
                                <span className="font-medium">
                                  {p.firstName} {p.lastName}
                                </span>
                                <span className="text-muted-foreground">{p.phone}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Current balance highlight */}
              {redeemPatient && redeemBalance !== null && (
                <div className="rounded-md bg-muted p-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{t('redeem.availableBalance')}</span>
                  <span className="text-xl font-bold flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    {t('redeem.balancePts', { balance: formatNumber(redeemBalance) })}
                  </span>
                </div>
              )}

              {/* Points */}
              <div className="space-y-2">
                <Label htmlFor="redeemPoints">{t('redeem.pointsLabel')}</Label>
                <Input
                  id="redeemPoints"
                  type="number"
                  min="1"
                  max={redeemBalance ?? undefined}
                  placeholder={t('redeem.pointsPlaceholder')}
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  required
                />
              </div>

              {/* Type (fixed) */}
              <div className="space-y-2">
                <Label>{t('redeem.typeLabel')}</Label>
                <Input value={t('type.REDEMPTION')} disabled />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="redeemDesc">{t('award.descriptionLabel')}</Label>
                <Input
                  id="redeemDesc"
                  placeholder={t('award.descriptionPlaceholder')}
                  value={redeemDesc}
                  onChange={(e) => setRedeemDesc(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={redeemSubmitting || !redeemPatient}
              >
                {redeemSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('redeem.submitting')}
                  </>
                ) : (
                  <>
                    <Minus className="mr-2 h-4 w-4" />
                    {t('redeem.submit')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ============ TRANSACTION LOG ============ */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                {t('log.title')}
              </CardTitle>
              <CardDescription>{t('log.description')}</CardDescription>
            </div>
            <div className="w-48">
              <Select
                value={filterType}
                onValueChange={(v) => setFilterType(v as PointType | 'ALL')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('log.filterPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_TYPE_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === 'ALL' ? t('allTypes') : t(`type.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p>{t('log.empty')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('log.colDate')}</TableHead>
                      <TableHead>{t('log.colPatient')}</TableHead>
                      <TableHead>{t('log.colType')}</TableHead>
                      <TableHead className="text-right">{t('log.colPoints')}</TableHead>
                      <TableHead>{t('log.colDescription')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.patient
                            ? `${tx.patient.firstName} ${tx.patient.lastName}`
                            : tx.patientId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={TYPE_BADGE_COLORS[tx.type] || ''}>
                            {t.has(`type.${tx.type}`) ? t(`type.${tx.type}`) : tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {tx.points > 0 ? (
                            <span className="text-green-600">+{tx.points}</span>
                          ) : (
                            <span className="text-red-600">{tx.points}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('log.pageInfo', {
                      page: pagination.page,
                      totalPages: pagination.totalPages,
                      total: pagination.total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchTransactions(pagination.page - 1)}
                    >
                      {t('previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchTransactions(pagination.page + 1)}
                    >
                      {t('next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
