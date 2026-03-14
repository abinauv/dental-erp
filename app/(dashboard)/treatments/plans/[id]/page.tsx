"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Edit,
  Printer,
  AlertCircle,
  Play,
  ClipboardCheck,
} from "lucide-react"
import {
  treatmentPlanStatusConfig,
  treatmentPlanItemStatusConfig,
  procedureCategoryConfig,
  formatCurrency,
  formatDate,
  calculatePlanProgress,
} from "@/lib/treatment-utils"

interface TreatmentPlanItem {
  id: string
  priority: number
  toothNumbers: string | null
  estimatedCost: string | number
  notes: string | null
  status: string
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
}

interface TreatmentPlan {
  id: string
  planNumber: string
  title: string
  notes: string | null
  status: string
  estimatedCost: string | number
  estimatedDuration: number | null
  startDate: string | null
  expectedEndDate: string | null
  completedDate: string | null
  consentGiven: boolean
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
  }
  items: TreatmentPlanItem[]
}

export default function TreatmentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [plan, setPlan] = useState<TreatmentPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [consentDialogOpen, setConsentDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const fetchPlan = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/treatment-plans/${id}`)
      if (!response.ok) throw new Error("Failed to fetch treatment plan")
      const data = await response.json()
      setPlan(data)
    } catch (error) {
      console.error("Error fetching treatment plan:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlan()
  }, [id])

  const handleStatusChange = async (status: string) => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatment-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error("Failed to update status")
      fetchPlan()
    } catch (error) {
      console.error("Error updating status:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConsentGiven = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatment-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentGiven: true,
          status: plan?.status === "PROPOSED" ? "ACCEPTED" : plan?.status,
        }),
      })
      if (!response.ok) throw new Error("Failed to record consent")
      setConsentDialogOpen(false)
      fetchPlan()
    } catch (error) {
      console.error("Error recording consent:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelPlan = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/treatment-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!response.ok) throw new Error("Failed to cancel plan")
      setCancelDialogOpen(false)
      fetchPlan()
    } catch (error) {
      console.error("Error cancelling plan:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = treatmentPlanStatusConfig[status] || {
      label: status,
      color: "text-foreground",
      bgColor: "bg-muted",
    }
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 text-sm`}>
        {config.label}
      </Badge>
    )
  }

  const getItemStatusBadge = (status: string) => {
    const config = treatmentPlanItemStatusConfig[status] || {
      label: status,
      color: "text-foreground",
      bgColor: "bg-muted",
    }
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0`}>
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

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Treatment plan not found</p>
        <Link href="/treatments/plans">
          <Button variant="outline">Back to Treatment Plans</Button>
        </Link>
      </div>
    )
  }

  const progress = calculatePlanProgress(plan.items)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/treatments/plans">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {plan.planNumber}
              </h1>
              {getStatusBadge(plan.status)}
              {plan.consentGiven && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Consent Given
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{plan.title}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {plan.status === "DRAFT" && (
            <Button onClick={() => handleStatusChange("PROPOSED")} disabled={actionLoading}>
              <FileText className="h-4 w-4 mr-2" />
              Propose to Patient
            </Button>
          )}
          {plan.status === "PROPOSED" && !plan.consentGiven && (
            <Button onClick={() => setConsentDialogOpen(true)}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Record Consent
            </Button>
          )}
          {plan.status === "ACCEPTED" && (
            <Button onClick={() => handleStatusChange("IN_PROGRESS")} disabled={actionLoading}>
              <Play className="h-4 w-4 mr-2" />
              Start Treatment
            </Button>
          )}
          {!["COMPLETED", "CANCELLED"].includes(plan.status) && (
            <>
              <Link href={`/treatments/plans/${id}/edit`}>
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
                Cancel Plan
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
          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Treatment Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {plan.items.filter(i => i.status === "COMPLETED").length} of{" "}
                    {plan.items.length} procedures completed
                  </span>
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Procedures */}
          <Card>
            <CardHeader>
              <CardTitle>Treatment Procedures</CardTitle>
              <CardDescription>
                Procedures in this treatment plan, ordered by priority
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Procedure</TableHead>
                    <TableHead>Teeth</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.priority}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.procedure.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.procedure.code}
                        </div>
                        <Badge
                          variant="outline"
                          className={`mt-1 ${procedureCategoryConfig[item.procedure.category]?.bgColor} ${procedureCategoryConfig[item.procedure.category]?.color} border-0`}
                        >
                          {procedureCategoryConfig[item.procedure.category]?.label}
                        </Badge>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{item.toothNumbers || "-"}</TableCell>
                      <TableCell>{formatCurrency(item.estimatedCost)}</TableCell>
                      <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        {item.status === "PENDING" && plan.status === "IN_PROGRESS" && (
                          <Link href={`/treatments/new?patientId=${plan.patient.id}&procedureId=${item.procedure.id}`}>
                            <Button size="sm" variant="outline">
                              Start
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">
                      Total Estimated Cost:
                    </TableCell>
                    <TableCell className="font-bold text-lg">
                      {formatCurrency(plan.estimatedCost)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes */}
          {plan.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{plan.notes}</p>
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
                    {plan.patient.firstName} {plan.patient.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {plan.patient.patientId}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {plan.patient.phone}
                </div>
                {plan.patient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {plan.patient.email}
                  </div>
                )}
              </div>

              <Link href={`/patients/${plan.patient.id}`}>
                <Button variant="outline" className="w-full">
                  View Patient Profile
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Plan Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Cost</div>
                  <div className="font-bold text-lg">
                    {formatCurrency(plan.estimatedCost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Procedures</div>
                  <div className="font-bold text-lg">{plan.items.length}</div>
                </div>
              </div>

              {plan.estimatedDuration && (
                <div>
                  <div className="text-sm text-muted-foreground">Est. Duration</div>
                  <div className="font-medium">
                    {Math.round(plan.estimatedDuration / 60)} hours
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(plan.createdAt)}</span>
                </div>
                {plan.startDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span>{formatDate(plan.startDate)}</span>
                  </div>
                )}
                {plan.expectedEndDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected End</span>
                    <span>{formatDate(plan.expectedEndDate)}</span>
                  </div>
                )}
                {plan.completedDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span>{formatDate(plan.completedDate)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Consent Dialog */}
      <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Patient Consent</DialogTitle>
            <DialogDescription>
              Confirm that the patient has given consent to proceed with this
              treatment plan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              By recording consent, you confirm that:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>The treatment plan has been explained to the patient</li>
              <li>All questions have been answered</li>
              <li>The patient understands the costs and procedures involved</li>
              <li>The patient has agreed to proceed</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConsentGiven} disabled={actionLoading}>
              {actionLoading ? "Recording..." : "Confirm Consent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Treatment Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this treatment plan? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelPlan}
              disabled={actionLoading}
            >
              {actionLoading ? "Cancelling..." : "Cancel Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
