"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Gift, Plus, Minus, Search, TrendingUp, Star, ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

type PointType = "VISIT" | "REFERRAL" | "TREATMENT" | "BIRTHDAY" | "SIGNUP" | "REDEMPTION"

const AWARD_TYPES: { value: PointType; label: string }[] = [
  { value: "VISIT", label: "Visit" },
  { value: "REFERRAL", label: "Referral" },
  { value: "TREATMENT", label: "Treatment" },
  { value: "BIRTHDAY", label: "Birthday" },
  { value: "SIGNUP", label: "Sign-up" },
]

const ALL_TYPES: { value: PointType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "VISIT", label: "Visit" },
  { value: "REFERRAL", label: "Referral" },
  { value: "TREATMENT", label: "Treatment" },
  { value: "BIRTHDAY", label: "Birthday" },
  { value: "SIGNUP", label: "Sign-up" },
  { value: "REDEMPTION", label: "Redemption" },
]

const TYPE_BADGE_COLORS: Record<string, string> = {
  VISIT: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  REFERRAL: "bg-green-100 text-green-800 hover:bg-green-100",
  TREATMENT: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  REDEMPTION: "bg-red-100 text-red-800 hover:bg-red-100",
  BIRTHDAY: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  SIGNUP: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
}

// ---------------------------------------------------------------------------
// Patient Search Hook (debounced)
// ---------------------------------------------------------------------------

function usePatientSearch() {
  const [query, setQuery] = useState("")
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
          const patients = Array.isArray(data) ? data : data.patients ?? []
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
    setQuery("")
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

  // ---- Award state ----
  const awardSearch = usePatientSearch()
  const [awardPatient, setAwardPatient] = useState<Patient | null>(null)
  const [awardBalance, setAwardBalance] = useState<number | null>(null)
  const [awardPoints, setAwardPoints] = useState("")
  const [awardType, setAwardType] = useState<PointType>("VISIT")
  const [awardDesc, setAwardDesc] = useState("")
  const [awardSubmitting, setAwardSubmitting] = useState(false)

  // ---- Redeem state ----
  const redeemSearch = usePatientSearch()
  const [redeemPatient, setRedeemPatient] = useState<Patient | null>(null)
  const [redeemBalance, setRedeemBalance] = useState<number | null>(null)
  const [redeemPoints, setRedeemPoints] = useState("")
  const [redeemDesc, setRedeemDesc] = useState("")
  const [redeemSubmitting, setRedeemSubmitting] = useState(false)

  // ---- Transaction log state ----
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filterType, setFilterType] = useState<PointType | "ALL">("ALL")
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
  const selectAwardPatient = useCallback(async (patient: Patient) => {
    setAwardPatient(patient)
    awardSearch.setShowDropdown(false)
    awardSearch.search("")
    const bal = await fetchBalance(patient.id)
    setAwardBalance(bal)
  }, [awardSearch, fetchBalance])

  // -------------------------------------------------------------------
  // Select patient for Redeem
  // -------------------------------------------------------------------
  const selectRedeemPatient = useCallback(async (patient: Patient) => {
    setRedeemPatient(patient)
    redeemSearch.setShowDropdown(false)
    redeemSearch.search("")
    const bal = await fetchBalance(patient.id)
    setRedeemBalance(bal)
  }, [redeemSearch, fetchBalance])

  // -------------------------------------------------------------------
  // Fetch transaction log
  // -------------------------------------------------------------------
  const fetchTransactions = useCallback(async (page: number = 1) => {
    setLogLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (filterType !== "ALL") params.set("type", filterType)
      const res = await fetch(`/api/loyalty?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setTransactions(data.transactions ?? [])
      setPagination(data.pagination ?? { page, limit: 20, total: 0, totalPages: 0 })
    } catch {
      toast({ title: "Failed to load transactions", variant: "destructive" })
    } finally {
      setLogLoading(false)
    }
  }, [filterType, toast])

  useEffect(() => {
    fetchTransactions(1)
  }, [fetchTransactions])

  // -------------------------------------------------------------------
  // Award submit
  // -------------------------------------------------------------------
  async function handleAward(e: React.FormEvent) {
    e.preventDefault()
    if (!awardPatient) {
      toast({ title: "Please select a patient", variant: "destructive" })
      return
    }
    const pts = parseInt(awardPoints)
    if (!pts || pts <= 0) {
      toast({ title: "Points must be a positive number", variant: "destructive" })
      return
    }

    setAwardSubmitting(true)
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: awardPatient.id,
          points: pts,
          type: awardType,
          description: awardDesc || `${awardType} points awarded`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to award points")
      }

      toast({ title: `+${pts} points awarded to ${awardPatient.firstName} ${awardPatient.lastName}` })

      // Reset form
      setAwardPatient(null)
      setAwardBalance(null)
      setAwardPoints("")
      setAwardType("VISIT")
      setAwardDesc("")
      awardSearch.clear()

      // Refresh log
      fetchTransactions(1)
    } catch (error: any) {
      toast({ title: error.message || "Failed to award points", variant: "destructive" })
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
      toast({ title: "Please select a patient", variant: "destructive" })
      return
    }
    const pts = parseInt(redeemPoints)
    if (!pts || pts <= 0) {
      toast({ title: "Points must be a positive number", variant: "destructive" })
      return
    }
    if (redeemBalance !== null && pts > redeemBalance) {
      toast({ title: "Insufficient points balance", variant: "destructive" })
      return
    }

    setRedeemSubmitting(true)
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: redeemPatient.id,
          points: -pts,
          type: "REDEMPTION",
          description: redeemDesc || "Points redeemed",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to redeem points")
      }

      toast({ title: `-${pts} points redeemed for ${redeemPatient.firstName} ${redeemPatient.lastName}` })

      // Reset form
      setRedeemPatient(null)
      setRedeemBalance(null)
      setRedeemPoints("")
      setRedeemDesc("")
      redeemSearch.clear()

      // Refresh log
      fetchTransactions(1)
    } catch (error: any) {
      toast({ title: error.message || "Failed to redeem points", variant: "destructive" })
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
            Loyalty Points
          </h1>
          <p className="text-muted-foreground">Award, redeem, and track loyalty points</p>
        </div>
      </div>

      {/* Award & Redeem side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============ AWARD POINTS ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Award Points
            </CardTitle>
            <CardDescription>Add loyalty points to a patient account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAward} className="space-y-4">
              {/* Patient search */}
              <div className="space-y-2">
                <Label>Patient *</Label>
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
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className="font-bold text-lg flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            {awardBalance.toLocaleString()}
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
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patient by name or phone..."
                      value={awardSearch.query}
                      onChange={(e) => awardSearch.search(e.target.value)}
                      onFocus={() => {
                        if (awardSearch.results.length > 0) awardSearch.setShowDropdown(true)
                      }}
                      className="pl-9"
                    />
                    {awardSearch.showDropdown && (awardSearch.results.length > 0 || awardSearch.searching) && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        {awardSearch.searching ? (
                          <div className="p-3 text-sm text-muted-foreground">Searching...</div>
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
                <Label htmlFor="awardPoints">Points *</Label>
                <Input
                  id="awardPoints"
                  type="number"
                  min="1"
                  placeholder="Enter points to award"
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(e.target.value)}
                  required
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={awardType} onValueChange={(v) => setAwardType(v as PointType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {AWARD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="awardDesc">Description</Label>
                <Input
                  id="awardDesc"
                  placeholder="Optional description"
                  value={awardDesc}
                  onChange={(e) => setAwardDesc(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={awardSubmitting || !awardPatient}>
                {awardSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Awarding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Award Points
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
              Redeem Points
            </CardTitle>
            <CardDescription>Redeem loyalty points from a patient account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRedeem} className="space-y-4">
              {/* Patient search */}
              <div className="space-y-2">
                <Label>Patient *</Label>
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
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className="font-bold text-lg flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            {redeemBalance.toLocaleString()}
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
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patient by name or phone..."
                      value={redeemSearch.query}
                      onChange={(e) => redeemSearch.search(e.target.value)}
                      onFocus={() => {
                        if (redeemSearch.results.length > 0) redeemSearch.setShowDropdown(true)
                      }}
                      className="pl-9"
                    />
                    {redeemSearch.showDropdown && (redeemSearch.results.length > 0 || redeemSearch.searching) && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        {redeemSearch.searching ? (
                          <div className="p-3 text-sm text-muted-foreground">Searching...</div>
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
                  <span className="text-sm font-medium">Available Balance</span>
                  <span className="text-xl font-bold flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    {redeemBalance.toLocaleString()} pts
                  </span>
                </div>
              )}

              {/* Points */}
              <div className="space-y-2">
                <Label htmlFor="redeemPoints">Points to Redeem *</Label>
                <Input
                  id="redeemPoints"
                  type="number"
                  min="1"
                  max={redeemBalance ?? undefined}
                  placeholder="Enter points to redeem"
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  required
                />
              </div>

              {/* Type (fixed) */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Input value="REDEMPTION" disabled />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="redeemDesc">Description</Label>
                <Input
                  id="redeemDesc"
                  placeholder="Optional description"
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
                    Redeeming...
                  </>
                ) : (
                  <>
                    <Minus className="mr-2 h-4 w-4" />
                    Redeem Points
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
                Transaction Log
              </CardTitle>
              <CardDescription>Recent loyalty point transactions</CardDescription>
            </div>
            <div className="w-48">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as PointType | "ALL")}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
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
              <p>No transactions found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.patient
                            ? `${tx.patient.firstName} ${tx.patient.lastName}`
                            : tx.patientId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={TYPE_BADGE_COLORS[tx.type] || ""}
                          >
                            {tx.type}
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
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchTransactions(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchTransactions(pagination.page + 1)}
                    >
                      Next
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
