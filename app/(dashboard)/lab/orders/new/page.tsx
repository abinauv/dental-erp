"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Search, User, FlaskConical, Save, Loader2 } from "lucide-react"

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
}

interface LabVendor {
  id: string
  name: string
  phone: string
  contactPerson: string | null
  specializations: string | null
  avgTurnaround: number | null
}

const WORK_TYPES = [
  { value: "crown", label: "Crown" },
  { value: "bridge", label: "Bridge" },
  { value: "denture", label: "Denture" },
  { value: "partial_denture", label: "Partial Denture" },
  { value: "implant_crown", label: "Implant Crown" },
  { value: "veneer", label: "Veneer" },
  { value: "inlay_onlay", label: "Inlay/Onlay" },
  { value: "night_guard", label: "Night Guard" },
  { value: "retainer", label: "Retainer" },
  { value: "aligner", label: "Aligner" },
  { value: "model", label: "Model" },
  { value: "other", label: "Other" },
]

export default function NewLabOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get("patientId")
  const { toast } = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [vendors, setVendors] = useState<LabVendor[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [patientSearch, setPatientSearch] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const [form, setForm] = useState({
    patientId: preselectedPatientId || "",
    labVendorId: "",
    workType: "",
    description: "",
    toothNumbers: "",
    shadeGuide: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDate: "",
    estimatedCost: "",
    notes: "",
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsRes, vendorsRes] = await Promise.all([
          fetch("/api/patients?limit=100"),
          fetch("/api/lab-vendors?status=active"),
        ])

        if (patientsRes.ok) {
          const data = await patientsRes.json()
          setPatients(data.patients || [])
          if (preselectedPatientId) {
            const patient = (data.patients || []).find(
              (p: Patient) => p.id === preselectedPatientId
            )
            if (patient) setSelectedPatient(patient)
          }
        }

        if (vendorsRes.ok) {
          const data = await vendorsRes.json()
          setVendors(data.data || [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [preselectedPatientId])

  const filteredPatients = patients.filter((patient) => {
    const s = patientSearch.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(s) ||
      patient.lastName.toLowerCase().includes(s) ||
      patient.phone.includes(patientSearch) ||
      patient.patientId.toLowerCase().includes(s)
    )
  })

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId)
    setSelectedPatient(patient || null)
    setForm((prev) => ({ ...prev, patientId }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.patientId) {
      toast({ variant: "destructive", title: "Error", description: "Please select a patient." })
      return
    }
    if (!form.labVendorId) {
      toast({ variant: "destructive", title: "Error", description: "Please select a lab vendor." })
      return
    }
    if (!form.workType) {
      toast({ variant: "destructive", title: "Error", description: "Please select a work type." })
      return
    }
    if (!form.orderDate) {
      toast({ variant: "destructive", title: "Error", description: "Please enter an order date." })
      return
    }
    if (!form.estimatedCost) {
      toast({ variant: "destructive", title: "Error", description: "Please enter estimated cost." })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        patientId: form.patientId,
        labVendorId: form.labVendorId,
        workType: form.workType,
        description: form.description || undefined,
        toothNumbers: form.toothNumbers || undefined,
        shadeGuide: form.shadeGuide || undefined,
        orderDate: form.orderDate,
        expectedDate: form.expectedDate || undefined,
        estimatedCost: parseFloat(form.estimatedCost),
        notes: form.notes || undefined,
      }

      const response = await fetch("/api/lab-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(data.error || `Failed to create lab order (${response.status})`)
      }

      const result = await response.json()

      toast({
        title: "Lab Order Created",
        description: `Order ${result.data.orderNumber} created successfully.`,
      })

      router.push("/lab")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create lab order",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/lab">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Lab Order</h1>
          <p className="text-muted-foreground">Create a new lab work order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient
            </CardTitle>
            <CardDescription>Select the patient for this lab order</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPatient.patientId} | {selectedPatient.phone}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedPatient(null)
                    setForm((prev) => ({ ...prev, patientId: "" }))
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patients by name, phone, or ID..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No patients found</div>
                  ) : (
                    filteredPatients.slice(0, 10).map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handlePatientSelect(patient.id)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {patient.firstName} {patient.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {patient.patientId} | {patient.phone}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lab Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Order Details
            </CardTitle>
            <CardDescription>Specify the lab work details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lab Vendor *</Label>
                <Select
                  value={form.labVendorId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, labVendorId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lab vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                        {vendor.avgTurnaround ? ` (${vendor.avgTurnaround}d avg)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Work Type *</Label>
                <Select
                  value={form.workType}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, workType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map((wt) => (
                      <SelectItem key={wt.value} value={wt.value}>
                        {wt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tooth Numbers</Label>
                <Input
                  value={form.toothNumbers}
                  onChange={(e) => setForm((prev) => ({ ...prev, toothNumbers: e.target.value }))}
                  placeholder="e.g. 11, 21, 36"
                />
              </div>

              <div className="space-y-2">
                <Label>Shade Guide</Label>
                <Input
                  value={form.shadeGuide}
                  onChange={(e) => setForm((prev) => ({ ...prev, shadeGuide: e.target.value }))}
                  placeholder="e.g. A2, B1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the lab work required..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates & Cost */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule & Cost</CardTitle>
            <CardDescription>Set dates and estimated cost</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Order Date *</Label>
                <Input
                  type="date"
                  value={form.orderDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, expectedDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Estimated Cost (INR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimatedCost: e.target.value }))}
                  placeholder="Enter estimated cost"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions or notes for the lab..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/lab">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Lab Order
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
