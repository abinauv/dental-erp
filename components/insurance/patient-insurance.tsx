"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit,
  BadgeCheck,
  IndianRupee,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/billing-utils"

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
  providerId: "",
  policyNumber: "",
  groupNumber: "",
  memberId: "",
  subscriberName: "",
  subscriberRelation: "Self",
  effectiveDate: "",
  expiryDate: "",
  coverageType: "",
  annualMaximum: "",
  deductible: "",
  copayPercentage: "",
}

export function PatientInsurance({ patientId }: { patientId: string }) {
  const { toast } = useToast()
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
      toast({ title: "Failed to load insurance policies", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/insurance-providers?activeOnly=true")
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
      groupNumber: p.groupNumber || "",
      memberId: p.memberId,
      subscriberName: p.subscriberName,
      subscriberRelation: p.subscriberRelation,
      effectiveDate: p.effectiveDate ? p.effectiveDate.split("T")[0] : "",
      expiryDate: p.expiryDate ? p.expiryDate.split("T")[0] : "",
      coverageType: p.coverageType || "",
      annualMaximum: p.annualMaximum ? String(Number(p.annualMaximum)) : "",
      deductible: p.deductible ? String(Number(p.deductible)) : "",
      copayPercentage: p.copayPercentage ? String(Number(p.copayPercentage)) : "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.providerId || !form.policyNumber || !form.memberId || !form.subscriberName || !form.effectiveDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const url = `/api/patients/${patientId}/insurance`
      const method = editingId ? "PUT" : "POST"
      const payload = editingId ? { policyId: editingId, ...form } : form
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      toast({ title: editingId ? "Policy updated" : "Policy added" })
      setDialogOpen(false)
      fetchPolicies()
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (policyId: string) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/insurance/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId }),
      })
      if (res.ok) {
        toast({ title: "Insurance verified successfully" })
        fetchPolicies()
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" })
    }
  }

  const handleToggleActive = async (policyId: string, isActive: boolean) => {
    try {
      await fetch(`/api/patients/${patientId}/insurance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, isActive: !isActive }),
      })
      toast({ title: isActive ? "Policy deactivated" : "Policy activated" })
      fetchPolicies()
    } catch {
      toast({ title: "Failed to update policy", variant: "destructive" })
    }
  }

  const getVerificationBadge = (p: InsurancePolicy) => {
    if (!p.verificationStatus) {
      return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" /> Unverified</Badge>
    }
    if (p.verificationStatus === "VERIFIED") {
      return <Badge variant="default" className="text-xs bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Verified</Badge>
    }
    if (p.verificationStatus === "EXPIRED") {
      return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Expired</Badge>
    }
    return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" /> {p.verificationStatus}</Badge>
  }

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Insurance Policies</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No insurance policies on file</p>
            <p className="text-sm">Add the patient&apos;s insurance information to enable claims and pre-authorizations</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((p) => (
            <Card key={p.id} className={!p.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      {p.provider.name}
                      {!p.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Policy: {p.policyNumber} {p.groupNumber && `· Group: ${p.groupNumber}`}
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
                    <p className="text-muted-foreground">Member ID</p>
                    <p className="font-medium">{p.memberId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Subscriber</p>
                    <p className="font-medium">{p.subscriberName} ({p.subscriberRelation})</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Effective</p>
                    <p className="font-medium">{formatDate(p.effectiveDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p className="font-medium">{p.expiryDate ? formatDate(p.expiryDate) : "N/A"}</p>
                  </div>
                </div>
                {(p.annualMaximum || p.deductible || p.copayPercentage) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t">
                    {p.annualMaximum && (
                      <div>
                        <p className="text-muted-foreground">Annual Maximum</p>
                        <p className="font-medium">{formatCurrency(Number(p.annualMaximum))}</p>
                      </div>
                    )}
                    {p.remainingAmount != null && (
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-medium text-green-600">{formatCurrency(Number(p.remainingAmount))}</p>
                      </div>
                    )}
                    {p.deductible != null && (
                      <div>
                        <p className="text-muted-foreground">Deductible</p>
                        <p className="font-medium">
                          {formatCurrency(Number(p.deductible))}
                          {p.deductibleMet && <span className="text-green-600 ml-1">(Met)</span>}
                        </p>
                      </div>
                    )}
                    {p.copayPercentage != null && (
                      <div>
                        <p className="text-muted-foreground">Co-pay</p>
                        <p className="font-medium">{Number(p.copayPercentage)}%</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleVerify(p.id)}>
                    <BadgeCheck className="h-4 w-4 mr-1" />
                    Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(p.id, p.isActive)}
                  >
                    {p.isActive ? (
                      <><XCircle className="h-4 w-4 mr-1" /> Deactivate</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Activate</>
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
            <DialogTitle>{editingId ? "Edit Insurance Policy" : "Add Insurance Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Insurance Provider *</Label>
              <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Policy Number *</Label>
                <Input
                  value={form.policyNumber}
                  onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                  placeholder="e.g., POL-12345"
                />
              </div>
              <div>
                <Label>Group Number</Label>
                <Input
                  value={form.groupNumber}
                  onChange={(e) => setForm({ ...form, groupNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Member ID *</Label>
                <Input
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  placeholder="e.g., MEM-001"
                />
              </div>
              <div>
                <Label>Subscriber Relation</Label>
                <Select value={form.subscriberRelation} onValueChange={(v) => setForm({ ...form, subscriberRelation: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Self", "Spouse", "Child", "Parent", "Other"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Subscriber Name *</Label>
                <Input
                  value={form.subscriberName}
                  onChange={(e) => setForm({ ...form, subscriberName: e.target.value })}
                  placeholder="Name of the policy holder"
                />
              </div>
              <div>
                <Label>Effective Date *</Label>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Coverage Type</Label>
                <Select value={form.coverageType} onValueChange={(v) => setForm({ ...form, coverageType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Family">Family</SelectItem>
                    <SelectItem value="Group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Annual Maximum</Label>
                <Input
                  type="number"
                  value={form.annualMaximum}
                  onChange={(e) => setForm({ ...form, annualMaximum: e.target.value })}
                  placeholder="₹"
                />
              </div>
              <div>
                <Label>Deductible</Label>
                <Input
                  type="number"
                  value={form.deductible}
                  onChange={(e) => setForm({ ...form, deductible: e.target.value })}
                  placeholder="₹"
                />
              </div>
              <div>
                <Label>Co-pay %</Label>
                <Input
                  type="number"
                  value={form.copayPercentage}
                  onChange={(e) => setForm({ ...form, copayPercentage: e.target.value })}
                  placeholder="%"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Add Policy"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
