"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SignaturePad } from "./signature-pad"
import { Loader2 } from "lucide-react"

export interface FormField {
  id: string
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "radio" | "signature" | "file" | "heading" | "paragraph"
  label: string
  placeholder?: string
  required?: boolean
  options?: string[] // For select, radio, checkbox-group
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  description?: string
  defaultValue?: string
}

interface FormRendererProps {
  fields: FormField[]
  onSubmit: (data: Record<string, unknown>, signature: string | null) => void
  initialData?: Record<string, unknown>
  initialSignature?: string | null
  readOnly?: boolean
  loading?: boolean
  showSignature?: boolean
  signatureLabel?: string
  submitLabel?: string
}

export function FormRenderer({
  fields,
  onSubmit,
  initialData = {},
  initialSignature = null,
  readOnly = false,
  loading = false,
  showSignature = true,
  signatureLabel,
  submitLabel = "Submit Form",
}: FormRendererProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  const [signature, setSignature] = useState<string | null>(initialSignature)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setValue = (id: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [id]: value }))
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    for (const field of fields) {
      if (field.type === "heading" || field.type === "paragraph") continue
      const val = formData[field.id]

      if (field.required) {
        if (val === undefined || val === null || val === "") {
          newErrors[field.id] = `${field.label} is required`
          continue
        }
      }

      if (val && field.validation) {
        const str = String(val)
        if (field.validation.minLength && str.length < field.validation.minLength) {
          newErrors[field.id] = `Minimum ${field.validation.minLength} characters`
        }
        if (field.validation.maxLength && str.length > field.validation.maxLength) {
          newErrors[field.id] = `Maximum ${field.validation.maxLength} characters`
        }
        if (field.type === "number") {
          const num = Number(val)
          if (field.validation.min !== undefined && num < field.validation.min) {
            newErrors[field.id] = `Minimum value is ${field.validation.min}`
          }
          if (field.validation.max !== undefined && num > field.validation.max) {
            newErrors[field.id] = `Maximum value is ${field.validation.max}`
          }
        }
      }
    }

    // Check signature if form has a signature field
    const hasSignatureField = fields.some((f) => f.type === "signature")
    if (hasSignatureField && showSignature && !signature) {
      newErrors["_signature"] = "Signature is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    if (!validate()) return
    onSubmit(formData, signature)
  }

  const renderField = (field: FormField) => {
    const val = formData[field.id]
    const error = errors[field.id]

    switch (field.type) {
      case "heading":
        return (
          <div key={field.id} className="pt-4 pb-2">
            <h3 className="text-lg font-semibold">{field.label}</h3>
            {field.description && (
              <p className="text-sm text-muted-foreground">{field.description}</p>
            )}
          </div>
        )

      case "paragraph":
        return (
          <div key={field.id} className="py-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{field.label}</p>
          </div>
        )

      case "text":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            <Input
              id={field.id}
              placeholder={field.placeholder}
              value={(val as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              disabled={readOnly}
              maxLength={field.validation?.maxLength}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            <Textarea
              id={field.id}
              placeholder={field.placeholder}
              value={(val as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              disabled={readOnly}
              rows={4}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "number":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="number"
              placeholder={field.placeholder}
              value={(val as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              disabled={readOnly}
              min={field.validation?.min}
              max={field.validation?.max}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "date":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={(val as string) || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              disabled={readOnly}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={(val as string) || ""}
              onValueChange={(v) => setValue(field.id, v)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "checkbox":
        if (field.options && field.options.length > 0) {
          // Checkbox group
          const selected = (val as string[]) || []
          return (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <div className="space-y-2">
                {field.options.map((opt) => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`${field.id}-${opt}`}
                      checked={selected.includes(opt)}
                      disabled={readOnly}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setValue(field.id, [...selected, opt])
                        } else {
                          setValue(field.id, selected.filter((s) => s !== opt))
                        }
                      }}
                    />
                    <label htmlFor={`${field.id}-${opt}`} className="text-sm cursor-pointer">
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )
        }
        // Single checkbox (boolean)
        return (
          <div key={field.id} className="flex items-start gap-2 py-2">
            <Checkbox
              id={field.id}
              checked={(val as boolean) || false}
              disabled={readOnly}
              onCheckedChange={(checked) => setValue(field.id, checked === true)}
            />
            <div className="space-y-1">
              <label htmlFor={field.id} className="text-sm font-medium cursor-pointer">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <RadioGroup
              value={(val as string) || ""}
              onValueChange={(v) => setValue(field.id, v)}
              disabled={readOnly}
            >
              {field.options?.map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                  <label htmlFor={`${field.id}-${opt}`} className="text-sm cursor-pointer">
                    {opt}
                  </label>
                </div>
              ))}
            </RadioGroup>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )

      case "signature":
        return (
          <div key={field.id} className="space-y-2 pt-4">
            <Label>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {!readOnly ? (
              <SignaturePad
                onSignatureChange={setSignature}
                initialSignature={signature}
                label={signatureLabel || field.description || "I agree to the terms above"}
              />
            ) : signature ? (
              <div className="border rounded-lg p-2 bg-white">
                <img src={signature} alt="Signature" className="max-h-[150px]" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No signature</p>
            )}
            {errors["_signature"] && (
              <p className="text-xs text-destructive">{errors["_signature"]}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(renderField)}

      {!readOnly && (
        <div className="pt-4">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
