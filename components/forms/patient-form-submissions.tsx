"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { FormRenderer, type FormField } from "./form-renderer"
import { FileText, Eye, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface FormSubmission {
  id: string
  templateId: string
  patientId: string | null
  appointmentId: string | null
  data: Record<string, unknown>
  signature: string | null
  signedAt: string | null
  status: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  createdAt: string
  template: {
    id: string
    name: string
    type: string
    fields?: FormField[]
  }
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SUBMITTED: { icon: <Clock className="h-3 w-3" />, label: "Pending Review", variant: "secondary" },
  REVIEWED: { icon: <Eye className="h-3 w-3" />, label: "Reviewed", variant: "outline" },
  APPROVED: { icon: <CheckCircle2 className="h-3 w-3" />, label: "Approved", variant: "default" },
  REJECTED: { icon: <XCircle className="h-3 w-3" />, label: "Rejected", variant: "destructive" },
}

interface PatientFormSubmissionsProps {
  patientId: string
}

export function PatientFormSubmissions({ patientId }: PatientFormSubmissionsProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [viewSubmission, setViewSubmission] = useState<FormSubmission | null>(null)
  const [reviewStatus, setReviewStatus] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    fetchSubmissions()
  }, [patientId])

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`/api/forms?patientId=${patientId}`)
      const data = await res.json()
      if (data.submissions) setSubmissions(data.submissions)
    } catch {
      toast.error("Failed to load form submissions")
    } finally {
      setLoading(false)
    }
  }

  const handleViewSubmission = async (submission: FormSubmission) => {
    // Fetch full submission with template fields
    try {
      const res = await fetch(`/api/forms/${submission.id}`)
      const data = await res.json()
      if (data.submission) {
        setViewSubmission(data.submission)
        setReviewStatus(data.submission.status)
        setReviewNotes(data.submission.reviewNotes || "")
      }
    } catch {
      toast.error("Failed to load submission details")
    }
  }

  const handleReview = async () => {
    if (!viewSubmission || !reviewStatus) return
    setReviewing(true)
    try {
      const res = await fetch(`/api/forms/${viewSubmission.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewStatus, reviewNotes }),
      })
      if (res.ok) {
        toast.success("Review saved")
        setViewSubmission(null)
        fetchSubmissions()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to save review")
      }
    } catch {
      toast.error("Failed to save review")
    } finally {
      setReviewing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Form Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No form submissions for this patient</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => {
                const sc = statusConfig[s.status] || statusConfig.SUBMITTED
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handleViewSubmission(s)}
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{s.template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {s.signedAt && " (Signed)"}
                      </div>
                    </div>
                    <Badge variant={sc.variant} className="flex items-center gap-1">
                      {sc.icon}
                      {sc.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View/Review Dialog */}
      <Dialog open={!!viewSubmission} onOpenChange={(open) => !open && setViewSubmission(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewSubmission?.template.name}</DialogTitle>
          </DialogHeader>

          {viewSubmission?.template.fields && (
            <div className="border-b pb-4 mb-4">
              <FormRenderer
                fields={viewSubmission.template.fields as FormField[]}
                onSubmit={() => {}}
                initialData={viewSubmission.data}
                initialSignature={viewSubmission.signature}
                readOnly
              />
            </div>
          )}

          {/* Review Section */}
          <div className="space-y-4">
            <h4 className="font-semibold">Review</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Set status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUBMITTED">Pending</SelectItem>
                    <SelectItem value="REVIEWED">Reviewed</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Review Notes</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewSubmission(null)}>
                Close
              </Button>
              <Button onClick={handleReview} disabled={reviewing}>
                {reviewing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
