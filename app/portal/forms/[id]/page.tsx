"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { FormRenderer, type FormField } from "@/components/forms/form-renderer"

interface Template {
  id: string
  name: string
  description: string | null
  type: string
  fields: FormField[]
}

interface Submission {
  id: string
  data: Record<string, unknown>
  signature: string | null
  status: string
  createdAt: string
}

export default function PatientFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetchForm()
  }, [id])

  const fetchForm = async () => {
    try {
      const res = await fetch(`/api/patient-portal/forms/${id}`)
      const data = await res.json()
      if (data.template) {
        setTemplate(data.template)
        if (data.existingSubmission) {
          setExistingSubmission(data.existingSubmission)
        }
      } else {
        toast.error("Form not found")
        router.push("/portal/forms")
      }
    } catch {
      toast.error("Failed to load form")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: Record<string, unknown>, signature: string | null) => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/patient-portal/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: id,
          data,
          signature,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        toast.success("Form submitted successfully")
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to submit form")
      }
    } catch {
      toast.error("Failed to submit form")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!template) return null

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
        <h2 className="text-2xl font-bold">Form Submitted</h2>
        <p className="text-muted-foreground">
          Your {template.name} has been submitted successfully. The clinic team will review it shortly.
        </p>
        <Button onClick={() => router.push("/portal/forms")}>
          Back to Forms
        </Button>
      </div>
    )
  }

  // Show read-only view if already submitted
  if (existingSubmission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/portal/forms")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">
              Submitted on {new Date(existingSubmission.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Badge>{existingSubmission.status}</Badge>
        </div>

        <Card>
          <CardContent className="pt-6">
            <FormRenderer
              fields={template.fields}
              onSubmit={() => {}}
              initialData={existingSubmission.data}
              initialSignature={existingSubmission.signature}
              readOnly
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/portal/forms")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FormRenderer
            fields={template.fields}
            onSubmit={handleSubmit}
            loading={submitting}
            submitLabel="Submit Form"
          />
        </CardContent>
      </Card>
    </div>
  )
}
