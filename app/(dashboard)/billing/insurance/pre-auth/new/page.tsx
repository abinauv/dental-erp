"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileCheck,
} from "lucide-react"
import { formatCurrency } from "@/lib/billing-utils"

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
}

interface Policy {
  id: string
  policyNumber: string
  memberId: string
  subscriberName: string
  annualMaximum: string | number | null
  remainingAmount: string | number | null
  provider: { id: string; name: string }
}

interface Procedure {
  name: string
  code: string
  cost: string
}

export default function NewPreAuthPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [patientSearch, setPatientSearch] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedPolicyId, setSelectedPolicyId] = useState("")
  const [procedures, setProcedures] = useState<Procedure[]>([{ name: "", code: "", cost: "" }])
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Search patients
  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatients([])
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setPatients(data.patients || [])
        }
      } catch {}
    }, 300)
    return () => clearTimeout(timeout)
  }, [patientSearch])

  // Fetch policies when patient selected
  useEffect(() => {
    if (!selectedPatient) {
      setPolicies([])
      setSelectedPolicyId("")
      return
    }
    const fetchPolicies = async () => {
      try {
        const res = await fetch(`/api/patients/${selectedPatient.id}/insurance`)
        if (res.ok) {
          const data = await res.json()
          setPolicies(data.filter((p: any) => p.isActive))
        }
      } catch {}
    }
    fetchPolicies()
  }, [selectedPatient])

  const addProcedure = () => {
    setProcedures([...procedures, { name: "", code: "", cost: "" }])
  }

  const removeProcedure = (index: number) => {
    if (procedures.length <= 1) return
    setProcedures(procedures.filter((_, i) => i !== index))
  }

  const updateProcedure = (index: number, field: keyof Procedure, value: string) => {
    const updated = [...procedures]
    updated[index] = { ...updated[index], [field]: value }
    setProcedures(updated)
  }

  const totalCost = procedures.reduce((sum, p) => sum + (parseFloat(p.cost) || 0), 0)

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedPolicyId) {
      toast({ title: "Please select a patient and insurance policy", variant: "destructive" })
      return
    }
    const validProcedures = procedures.filter((p) => p.name.trim())
    if (validProcedures.length === 0) {
      toast({ title: "Add at least one procedure", variant: "destructive" })
      return
    }
    if (totalCost <= 0) {
      toast({ title: "Total estimated cost must be greater than 0", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/pre-authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          insurancePolicyId: selectedPolicyId,
          procedures: validProcedures.map((p) => ({
            name: p.name.trim(),
            code: p.code.trim() || undefined,
            cost: parseFloat(p.cost) || 0,
          })),
          estimatedCost: totalCost,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create")
      }

      toast({ title: "Pre-authorization request created" })
      router.push("/billing/insurance/pre-auth")
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Pre-Authorization</h1>
          <p className="text-muted-foreground">Request insurance pre-approval for treatment</p>
        </div>
      </div>

      {/* Step 1: Patient Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Select Patient</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPatient ? (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div>
                <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p className="text-sm text-muted-foreground">{selectedPatient.patientId}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedPatient(null); setPatientSearch("") }}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search patient by name, ID, or phone..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onClick={() => {
                        setSelectedPatient(p)
                        setPatientSearch("")
                        setPatients([])
                      }}
                    >
                      <span className="font-medium">{p.firstName} {p.lastName}</span>
                      <span className="text-muted-foreground ml-2">{p.patientId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Insurance Policy */}
      {selectedPatient && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Select Insurance Policy</CardTitle>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active insurance policies found for this patient.</p>
            ) : (
              <div className="space-y-3">
                <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.provider.name} — {p.policyNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPolicy && (
                  <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-lg p-3">
                    <div>
                      <p className="text-muted-foreground">Member ID</p>
                      <p className="font-medium">{selectedPolicy.memberId}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Subscriber</p>
                      <p className="font-medium">{selectedPolicy.subscriberName}</p>
                    </div>
                    {selectedPolicy.annualMaximum && (
                      <div>
                        <p className="text-muted-foreground">Annual Maximum</p>
                        <p className="font-medium">{formatCurrency(Number(selectedPolicy.annualMaximum))}</p>
                      </div>
                    )}
                    {selectedPolicy.remainingAmount != null && (
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-medium text-green-600">{formatCurrency(Number(selectedPolicy.remainingAmount))}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Procedures */}
      {selectedPolicyId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">3. Procedures</CardTitle>
              <Button variant="outline" size="sm" onClick={addProcedure}>
                <Plus className="h-4 w-4 mr-1" /> Add Procedure
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {procedures.map((proc, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <Label className="text-xs">Procedure Name *</Label>}
                    <Input
                      placeholder="e.g., Root Canal Treatment"
                      value={proc.name}
                      onChange={(e) => updateProcedure(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className="text-xs">Code</Label>}
                    <Input
                      placeholder="e.g., D3310"
                      value={proc.code}
                      onChange={(e) => updateProcedure(i, "code", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className="text-xs">Cost (₹) *</Label>}
                    <Input
                      type="number"
                      placeholder="0"
                      value={proc.cost}
                      onChange={(e) => updateProcedure(i, "cost", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProcedure(i)}
                      disabled={procedures.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t">
                <p className="text-sm font-medium">
                  Total Estimated Cost: <span className="text-lg">{formatCurrency(totalCost)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Notes & Submit */}
      {selectedPolicyId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Additional Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Any additional notes for the pre-authorization request..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                <FileCheck className="h-4 w-4 mr-2" />
                {saving ? "Creating..." : "Create Pre-Authorization"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
