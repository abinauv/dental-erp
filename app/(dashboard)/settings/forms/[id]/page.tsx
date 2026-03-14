"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { FormRenderer, type FormField } from "@/components/forms/form-renderer"

const FIELD_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio Buttons" },
  { value: "signature", label: "Signature" },
  { value: "heading", label: "Section Heading" },
  { value: "paragraph", label: "Paragraph Text" },
] as const

const FORM_TYPES = [
  { value: "MEDICAL_HISTORY", label: "Medical History" },
  { value: "CONSENT", label: "Consent Form" },
  { value: "INTAKE", label: "Intake Form" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "CUSTOM", label: "Custom" },
]

function generateId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function EditFormTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("CUSTOM")
  const [isActive, setIsActive] = useState(true)
  const [fields, setFields] = useState<FormField[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [submissionCount, setSubmissionCount] = useState(0)

  useEffect(() => {
    fetchTemplate()
  }, [id])

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`/api/settings/forms/${id}`)
      const data = await res.json()
      if (data.template) {
        setName(data.template.name)
        setDescription(data.template.description || "")
        setType(data.template.type)
        setIsActive(data.template.isActive)
        setFields(data.template.fields as FormField[])
        setSubmissionCount(data.template._count?.submissions || 0)
      } else {
        toast.error("Template not found")
        router.push("/settings/forms")
      }
    } catch {
      toast.error("Failed to load template")
    } finally {
      setLoading(false)
    }
  }

  const addField = (fieldType: string) => {
    const newField: FormField = {
      id: generateId(),
      type: fieldType as FormField["type"],
      label: fieldType === "heading" ? "Section Title" : fieldType === "paragraph" ? "Enter informational text here" : "",
      required: false,
      options: ["select", "radio", "checkbox"].includes(fieldType) ? ["Option 1", "Option 2"] : undefined,
    }
    setFields((prev) => [...prev, newField])
    setEditingField(newField.id)
  }

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    )
  }

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
    if (editingField === fieldId) setEditingField(null)
  }

  const moveField = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return
    const newFields = [...fields]
    ;[newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]]
    setFields(newFields)
  }

  const addOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return
    const opts = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`]
    updateField(fieldId, { options: opts })
  }

  const updateOption = (fieldId: string, optIndex: number, value: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return
    const opts = [...(field.options || [])]
    opts[optIndex] = value
    updateField(fieldId, { options: opts })
  }

  const removeOption = (fieldId: string, optIndex: number) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field || (field.options?.length || 0) <= 1) return
    const opts = (field.options || []).filter((_, i) => i !== optIndex)
    updateField(fieldId, { options: opts })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required")
      return
    }
    if (fields.length === 0) {
      toast.error("Add at least one field")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/settings/forms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, type, fields, isActive }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Template updated")
      } else {
        toast.error(data.error || "Failed to save")
      }
    } catch {
      toast.error("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (showPreview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Preview: {name}</h1>
              <p className="text-muted-foreground">This is how the form will appear to patients</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            Back to Editor
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </CardHeader>
          <CardContent>
            <FormRenderer
              fields={fields}
              onSubmit={() => toast.info("Preview mode — form not submitted")}
              submitLabel="Submit (Preview)"
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/settings/forms")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit: {name}</h1>
            <p className="text-muted-foreground">
              {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="text-sm">{isActive ? "Active" : "Inactive"}</Label>
          </div>
          <Button variant="outline" onClick={() => setShowPreview(true)} disabled={fields.length === 0}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Form Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form Fields ({fields.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No fields yet. Add fields from the panel on the right.
                </div>
              )}

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`border rounded-lg p-4 ${editingField === field.id ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-xs shrink-0">
                      {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
                    </Badge>
                    <span className="font-medium text-sm truncate flex-1">
                      {field.label || "(no label)"}
                    </span>
                    {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(index, -1)} disabled={index === 0}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingField(editingField === field.id ? null : field.id)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(field.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {editingField === field.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Label</Label>
                          <Input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} />
                        </div>
                        {!["heading", "paragraph", "signature", "checkbox"].includes(field.type) && (
                          <div className="space-y-1">
                            <Label className="text-xs">Placeholder</Label>
                            <Input value={field.placeholder || ""} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} />
                          </div>
                        )}
                      </div>

                      {field.options && (
                        <div className="space-y-2">
                          <Label className="text-xs">Options</Label>
                          {field.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <Input value={opt} onChange={(e) => updateOption(field.id, oi, e.target.value)} className="flex-1" />
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOption(field.id, oi)} disabled={(field.options?.length || 0) <= 1}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => addOption(field.id)}>
                            <Plus className="h-3 w-3 mr-1" /> Add Option
                          </Button>
                        </div>
                      )}

                      {!["heading", "paragraph"].includes(field.type) && (
                        <div className="flex items-center gap-2">
                          <Switch checked={field.required || false} onCheckedChange={(checked) => updateField(field.id, { required: checked })} />
                          <Label className="text-xs">Required</Label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Add Field</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FIELD_TYPES.map((ft) => (
                <Button key={ft.value} variant="outline" className="w-full justify-start" onClick={() => addField(ft.value)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {ft.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
