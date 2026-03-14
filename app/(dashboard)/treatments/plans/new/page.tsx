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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, User, Plus, Trash2, Save, AlertCircle, GripVertical } from "lucide-react"
import {
  procedureCategoryConfig,
  formatCurrency,
} from "@/lib/treatment-utils"

interface Patient {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
}

interface Procedure {
  id: string
  code: string
  name: string
  category: string
  defaultDuration: number
  basePrice: string | number
}

interface PlanItem {
  procedureId: string
  procedureName: string
  procedureCode: string
  category: string
  toothNumbers: string
  estimatedCost: number
  notes: string
}

export default function NewTreatmentPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get("patientId")

  const [patients, setPatients] = useState<Patient[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [patientSearch, setPatientSearch] = useState("")

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [startDate, setStartDate] = useState("")
  const [expectedEndDate, setExpectedEndDate] = useState("")
  const [items, setItems] = useState<PlanItem[]>([])

  // Add procedure modal state
  const [selectedProcedureId, setSelectedProcedureId] = useState("")
  const [itemToothNumbers, setItemToothNumbers] = useState("")
  const [itemNotes, setItemNotes] = useState("")
  const [itemCost, setItemCost] = useState("")

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [patientsRes, proceduresRes] = await Promise.all([
          fetch("/api/patients?limit=100"),
          fetch("/api/procedures?all=true&isActive=true"),
        ])

        if (patientsRes.ok) {
          const data = await patientsRes.json()
          setPatients(data.patients)
          if (preselectedPatientId) {
            const patient = data.patients.find((p: Patient) => p.id === preselectedPatientId)
            if (patient) setSelectedPatient(patient)
          }
        }

        if (proceduresRes.ok) {
          const data = await proceduresRes.json()
          setProcedures(data.procedures)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [preselectedPatientId])

  const filteredPatients = patients.filter((patient) => {
    const searchLower = patientSearch.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(searchLower) ||
      patient.lastName.toLowerCase().includes(searchLower) ||
      patient.phone.includes(patientSearch) ||
      patient.patientId.toLowerCase().includes(searchLower)
    )
  })

  const groupedProcedures = procedures.reduce((acc, proc) => {
    if (!acc[proc.category]) {
      acc[proc.category] = []
    }
    acc[proc.category].push(proc)
    return acc
  }, {} as Record<string, Procedure[]>)

  const handleAddProcedure = () => {
    if (!selectedProcedureId) return

    const procedure = procedures.find((p) => p.id === selectedProcedureId)
    if (!procedure) return

    const newItem: PlanItem = {
      procedureId: procedure.id,
      procedureName: procedure.name,
      procedureCode: procedure.code,
      category: procedure.category,
      toothNumbers: itemToothNumbers,
      estimatedCost: itemCost ? parseFloat(itemCost) : Number(procedure.basePrice),
      notes: itemNotes,
    }

    setItems([...items, newItem])

    // Reset form
    setSelectedProcedureId("")
    setItemToothNumbers("")
    setItemNotes("")
    setItemCost("")
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotalCost = () => {
    return items.reduce((sum, item) => sum + item.estimatedCost, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!selectedPatient) {
      setError("Please select a patient")
      return
    }

    if (!title) {
      setError("Please enter a title for the treatment plan")
      return
    }

    if (items.length === 0) {
      setError("Please add at least one procedure to the plan")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/treatment-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          title,
          notes,
          startDate: startDate || null,
          expectedEndDate: expectedEndDate || null,
          items: items.map((item, index) => ({
            procedureId: item.procedureId,
            toothNumbers: item.toothNumbers || null,
            priority: index + 1,
            estimatedCost: item.estimatedCost,
            notes: item.notes || null,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create treatment plan")
      }

      const plan = await response.json()
      router.push(`/treatments/plans/${plan.id}`)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/treatments/plans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Treatment Plan</h1>
          <p className="text-muted-foreground">
            Create a comprehensive treatment plan for a patient
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
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
                  onClick={() => setSelectedPatient(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patients..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {filteredPatients.slice(0, 10).map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-muted/50 border-b last:border-b-0 text-left"
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
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Full Mouth Rehabilitation, Orthodontic Treatment"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the treatment plan..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Expected Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedEndDate">Expected End Date</Label>
                <Input
                  id="expectedEndDate"
                  type="date"
                  value={expectedEndDate}
                  onChange={(e) => setExpectedEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Procedures */}
        <Card>
          <CardHeader>
            <CardTitle>Procedures</CardTitle>
            <CardDescription>
              Add procedures to the treatment plan in order of priority
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add Procedure Form */}
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Procedure</Label>
                  <Select value={selectedProcedureId} onValueChange={setSelectedProcedureId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select procedure" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedProcedures).map(([category, procs]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                            {procedureCategoryConfig[category]?.label || category}
                          </div>
                          {procs.map((proc) => (
                            <SelectItem key={proc.id} value={proc.id}>
                              {proc.code} - {proc.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tooth Numbers</Label>
                  <Input
                    value={itemToothNumbers}
                    onChange={(e) => setItemToothNumbers(e.target.value)}
                    placeholder="e.g., 11,12,13 or 11-13"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    placeholder={selectedProcedureId
                      ? `Default: ${formatCurrency(procedures.find(p => p.id === selectedProcedureId)?.basePrice || 0)}`
                      : "Enter cost"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Procedure notes..."
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddProcedure}
                disabled={!selectedProcedureId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Procedure
              </Button>
            </div>

            {/* Procedures List */}
            {items.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Teeth</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.procedureName}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.procedureCode}
                          </div>
                          <Badge
                            variant="outline"
                            className={`mt-1 ${procedureCategoryConfig[item.category]?.bgColor} ${procedureCategoryConfig[item.category]?.color} border-0`}
                          >
                            {procedureCategoryConfig[item.category]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.toothNumbers || "-"}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(item.estimatedCost)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        Total Estimated Cost:
                      </TableCell>
                      <TableCell className="font-bold text-lg">
                        {formatCurrency(calculateTotalCost())}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/treatments/plans">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              "Creating..."
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Treatment Plan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
