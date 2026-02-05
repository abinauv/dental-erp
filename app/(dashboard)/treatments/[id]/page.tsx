"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  Play,
  CheckCircle,
  XCircle,
  Edit,
  Printer,
  AlertCircle,
  Pill,
  Receipt,
} from "lucide-react"
import {
  treatmentStatusConfig,
  procedureCategoryConfig,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatToothNumbers,
  parseToothNumbers,
  toothNames,
} from "@/lib/treatment-utils"

interface Treatment {
  id: string
  treatmentNo: string
  chiefComplaint: string | null
  diagnosis: string | null
  findings: string | null
  procedureNotes: string | null
  materialsUsed: string | null
  complications: string | null
  toothNumbers: string | null
  status: string
  cost: string | number
  startTime: string | null
  endTime: string | null
  followUpRequired: boolean
  followUpDate: string | null
  createdAt: string
  updatedAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    dateOfBirth: string | null
    gender: string | null
    bloodGroup: string | null
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
    phone: string | null
  }
  procedure: {
    id: string
    code: string
    name: string
    category: string
    description: string | null
    defaultDuration: number
    basePrice: string | number
    preInstructions: string | null
    postInstructions: string | null
  }
  appointment: {
    id: string
    appointmentNo: string
    scheduledDate: string
    scheduledTime: string
    status: string
  } | null
  prescriptions: any[]
  invoiceItems: any[]
}

export default function TreatmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [loading, setLoading] = useState(true)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Complete form state
  const [completeFormData, setCompleteFormData] = useState({
    procedureNotes: "",
    materialsUsed: "",
    complications: "",
    followUpRequired: false,
    followUpDate: "",
  })

  const fetchTreatment = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/treatments/${id}`)
      if (!response.ok) throw new Error("Failed to fetch treatment")
      const data = await response.json()
      setTreatment(data)

      // Pre-fill complete form with existing data
      setCompleteFormData({
        procedureNotes: data.procedureNotes || "",
        materialsUsed: data.materialsUsed || "",
        complications: data.complications || "",
        followUpRequired: data.followUpRequired || false,
        followUpDate: data.followUpDate ? data.followUpDate.split("T")[0] : "",
      })
    } catch (error) {
      console.error("Error fetching treatment:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTreatment()
  }, [id])

  const handleStartTreatment = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatments/${id}/start`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to start treatment")
      fetchTreatment()
    } catch (error) {
      console.error("Error starting treatment:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteTreatment = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatments/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeFormData),
      })
      if (!response.ok) throw new Error("Failed to complete treatment")
      setCompleteDialogOpen(false)
      fetchTreatment()
    } catch (error) {
      console.error("Error completing treatment:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelTreatment = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!response.ok) throw new Error("Failed to cancel treatment")
      setCancelDialogOpen(false)
      fetchTreatment()
    } catch (error) {
      console.error("Error cancelling treatment:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = treatmentStatusConfig[status] || {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
    }
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 text-sm`}>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!treatment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Treatment not found</p>
        <Link href="/treatments">
          <Button variant="outline">Back to Treatments</Button>
        </Link>
      </div>
    )
  }

  const teeth = treatment.toothNumbers ? parseToothNumbers(treatment.toothNumbers) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/treatments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {treatment.treatmentNo}
              </h1>
              {getStatusBadge(treatment.status)}
            </div>
            <p className="text-muted-foreground">
              Created on {formatDate(treatment.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {treatment.status === "PLANNED" && (
            <Button onClick={handleStartTreatment} disabled={actionLoading}>
              <Play className="h-4 w-4 mr-2" />
              Start Treatment
            </Button>
          )}
          {treatment.status === "IN_PROGRESS" && (
            <Button onClick={() => setCompleteDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Treatment
            </Button>
          )}
          {treatment.status !== "COMPLETED" && treatment.status !== "CANCELLED" && (
            <>
              <Link href={`/treatments/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => setCancelDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Procedure Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Procedure Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-lg">{treatment.procedure.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Code: {treatment.procedure.code}
                  </div>
                </div>
                <Badge
                  className={`${procedureCategoryConfig[treatment.procedure.category]?.bgColor} ${procedureCategoryConfig[treatment.procedure.category]?.color} border-0`}
                >
                  {procedureCategoryConfig[treatment.procedure.category]?.label}
                </Badge>
              </div>

              {treatment.procedure.description && (
                <p className="text-sm text-muted-foreground">
                  {treatment.procedure.description}
                </p>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Treatment Cost</div>
                  <div className="font-medium text-lg">
                    {formatCurrency(treatment.cost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Base Price</div>
                  <div className="font-medium">
                    {formatCurrency(treatment.procedure.basePrice)}
                  </div>
                </div>
              </div>

              {treatment.startTime && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Started: {formatDateTime(treatment.startTime)}</span>
                  </div>
                  {treatment.endTime && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Completed: {formatDateTime(treatment.endTime)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teeth Affected */}
          {teeth.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Teeth Affected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {teeth.map((tooth) => (
                    <div
                      key={tooth}
                      className="px-3 py-2 bg-gray-100 rounded-lg text-sm"
                    >
                      <span className="font-medium">{tooth}</span>
                      <span className="text-muted-foreground ml-1">
                        - {toothNames[tooth]?.split(" ").slice(-2).join(" ")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Clinical Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {treatment.chiefComplaint && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Chief Complaint
                  </div>
                  <p className="mt-1">{treatment.chiefComplaint}</p>
                </div>
              )}

              {treatment.diagnosis && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Diagnosis
                  </div>
                  <p className="mt-1">{treatment.diagnosis}</p>
                </div>
              )}

              {treatment.findings && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Clinical Findings
                  </div>
                  <p className="mt-1">{treatment.findings}</p>
                </div>
              )}

              {treatment.procedureNotes && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Procedure Notes
                  </div>
                  <p className="mt-1">{treatment.procedureNotes}</p>
                </div>
              )}

              {treatment.materialsUsed && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Materials Used
                  </div>
                  <p className="mt-1">{treatment.materialsUsed}</p>
                </div>
              )}

              {treatment.complications && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground text-amber-600">
                    Complications
                  </div>
                  <p className="mt-1">{treatment.complications}</p>
                </div>
              )}

              {!treatment.chiefComplaint &&
                !treatment.diagnosis &&
                !treatment.findings &&
                !treatment.procedureNotes && (
                  <p className="text-muted-foreground text-center py-4">
                    No clinical notes recorded
                  </p>
                )}
            </CardContent>
          </Card>

          {/* Pre/Post Instructions */}
          {(treatment.procedure.preInstructions ||
            treatment.procedure.postInstructions) && (
            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {treatment.procedure.preInstructions && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Pre-procedure Instructions
                    </div>
                    <p className="mt-1">{treatment.procedure.preInstructions}</p>
                  </div>
                )}
                {treatment.procedure.postInstructions && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Post-procedure Instructions
                    </div>
                    <p className="mt-1">{treatment.procedure.postInstructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-medium">
                    {treatment.patient.firstName} {treatment.patient.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {treatment.patient.patientId}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {treatment.patient.phone}
                </div>
                {treatment.patient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {treatment.patient.email}
                  </div>
                )}
                {treatment.patient.bloodGroup && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Blood Group:</span>
                    <Badge variant="outline">{treatment.patient.bloodGroup}</Badge>
                  </div>
                )}
              </div>

              <Link href={`/patients/${treatment.patient.id}`}>
                <Button variant="outline" className="w-full">
                  View Patient Profile
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Doctor Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Doctor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-medium">
                Dr. {treatment.doctor.firstName} {treatment.doctor.lastName}
              </div>
              {treatment.doctor.specialization && (
                <div className="text-sm text-muted-foreground">
                  {treatment.doctor.specialization}
                </div>
              )}
              {treatment.doctor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {treatment.doctor.phone}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointment Info */}
          {treatment.appointment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Appointment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="font-medium">{treatment.appointment.appointmentNo}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(treatment.appointment.scheduledDate)} at{" "}
                  {treatment.appointment.scheduledTime}
                </div>
                <Link href={`/appointments/${treatment.appointment.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View Appointment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Follow-up */}
          {treatment.followUpRequired && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                  Follow-up Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                {treatment.followUpDate ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(treatment.followUpDate)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Date not scheduled
                  </p>
                )}
                <Button variant="outline" size="sm" className="w-full mt-4">
                  Schedule Follow-up
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Prescriptions */}
          {treatment.prescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  Prescriptions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {treatment.prescriptions.length} prescription(s) issued
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  View Prescriptions
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          {treatment.invoiceItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Billing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {treatment.invoiceItems.length} invoice item(s)
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  View Invoices
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Complete Treatment Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Treatment</DialogTitle>
            <DialogDescription>
              Add final notes and complete this treatment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="procedureNotes">Procedure Notes</Label>
              <Textarea
                id="procedureNotes"
                value={completeFormData.procedureNotes}
                onChange={(e) =>
                  setCompleteFormData({
                    ...completeFormData,
                    procedureNotes: e.target.value,
                  })
                }
                placeholder="Final procedure notes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialsUsed">Materials Used</Label>
              <Textarea
                id="materialsUsed"
                value={completeFormData.materialsUsed}
                onChange={(e) =>
                  setCompleteFormData({
                    ...completeFormData,
                    materialsUsed: e.target.value,
                  })
                }
                placeholder="List materials used..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complications">Complications (if any)</Label>
              <Textarea
                id="complications"
                value={completeFormData.complications}
                onChange={(e) =>
                  setCompleteFormData({
                    ...completeFormData,
                    complications: e.target.value,
                  })
                }
                placeholder="Document any complications..."
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="followUpRequired"
                checked={completeFormData.followUpRequired}
                onCheckedChange={(checked) =>
                  setCompleteFormData({
                    ...completeFormData,
                    followUpRequired: checked as boolean,
                  })
                }
              />
              <Label htmlFor="followUpRequired">Follow-up required</Label>
            </div>

            {completeFormData.followUpRequired && (
              <div className="space-y-2">
                <Label htmlFor="followUpDate">Follow-up Date</Label>
                <Input
                  id="followUpDate"
                  type="date"
                  value={completeFormData.followUpDate}
                  onChange={(e) =>
                    setCompleteFormData({
                      ...completeFormData,
                      followUpDate: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteTreatment} disabled={actionLoading}>
              {actionLoading ? "Completing..." : "Complete Treatment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Treatment Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Treatment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this treatment? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Treatment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelTreatment}
              disabled={actionLoading}
            >
              {actionLoading ? "Cancelling..." : "Cancel Treatment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
