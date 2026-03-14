"use client"

import { useState, useRef, useCallback } from "react"
import {
  Upload, Columns3, Eye, CheckCircle2, DatabaseZap,
  Users, UserCog, CalendarDays, Stethoscope, Receipt,
  CreditCard, Package, AlertTriangle, ChevronLeft,
  ChevronRight, FileSpreadsheet, Loader2, X, Check,
  ArrowLeft, Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ENTITY_SCHEMAS } from "@/lib/import/schema-definitions"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ValidationError {
  row: number
  field: string
  value: string
  message: string
  severity: "error" | "warning"
}

interface ValidationResult {
  valid: boolean
  totalRows: number
  validRows: number
  errorCount: number
  warningCount: number
  errors: ValidationError[]
  transformedPreview: Record<string, any>[]
  foreignKeyResolution: {
    resolved: number
    unresolved: { row: number; field: string; value: string }[]
  }
}

interface ImportResult {
  success: boolean
  jobId: string
  totalRows: number
  imported: number
  skipped: number
  errors: { row: number; message: string }[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 1, title: "Upload File", icon: Upload },
  { id: 2, title: "Map Columns", icon: Columns3 },
  { id: 3, title: "Preview & Edit", icon: Eye },
  { id: 4, title: "Validate", icon: CheckCircle2 },
  { id: 5, title: "Confirm Import", icon: DatabaseZap },
]

const ENTITY_OPTIONS = [
  { key: "patients", label: "Patients", desc: "Demographics, contact info", icon: Users, color: "text-blue-600 bg-blue-50" },
  { key: "staff", label: "Staff", desc: "Doctors, nurses, admin", icon: UserCog, color: "text-purple-600 bg-purple-50" },
  { key: "appointments", label: "Appointments", desc: "Scheduled visits", icon: CalendarDays, color: "text-green-600 bg-green-50" },
  { key: "treatments", label: "Treatments", desc: "Procedures & records", icon: Stethoscope, color: "text-red-600 bg-red-50" },
  { key: "invoices", label: "Invoices", desc: "Bills & amounts", icon: Receipt, color: "text-orange-600 bg-orange-50" },
  { key: "payments", label: "Payments", desc: "Payment transactions", icon: CreditCard, color: "text-indigo-600 bg-indigo-50" },
  { key: "inventory", label: "Inventory", desc: "Stock items & levels", icon: Package, color: "text-teal-600 bg-teal-50" },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DataImportPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Wizard state
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [entityType, setEntityType] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Step 2
  const [jobId, setJobId] = useState<string | null>(null)
  const [sourceColumns, setSourceColumns] = useState<string[]>([])
  const [sampleData, setSampleData] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [splitFields, setSplitFields] = useState<any[]>([])
  const [aiError, setAiError] = useState<string | null>(null)

  // Step 3
  const [previewData, setPreviewData] = useState<Record<string, any>[]>([])
  const [editedRows, setEditedRows] = useState<Record<number, Record<string, string>>>({})

  // Step 4
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [skipErrorRows, setSkipErrorRows] = useState(false)

  // Step 5
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const schema = entityType ? ENTITY_SCHEMAS[entityType] : null

  // ---------------------------------------------------------------------------
  // Step 1: Upload
  // ---------------------------------------------------------------------------
  const handleFileSelect = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["csv", "xlsx", "xls", "pdf"].includes(ext || "")) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Please use CSV, Excel, or PDF files." })
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum file size is 20MB." })
      return
    }
    setSelectedFile(file)
  }, [toast])

  const handleUpload = async () => {
    if (!selectedFile || !entityType) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", selectedFile)
      fd.append("entityType", entityType)

      const res = await fetch("/api/data-import/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")

      setJobId(data.jobId)
      setSourceColumns(data.columns)
      setSampleData(data.sampleData)
      setTotalRows(data.totalRows)
      setStep(2)

      // Auto-trigger AI mapping
      await runAiMapping(data.jobId)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: AI Mapping
  // ---------------------------------------------------------------------------
  const runAiMapping = async (jId: string) => {
    setLoading(true)
    setAiError(null)
    try {
      const res = await fetch("/api/data-import/ai-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: jId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Mapping failed")

      setMapping(data.mapping || {})
      setConfidence(data.confidence || {})
      setSplitFields(data.splitFields || [])
      if (data.aiError) setAiError(data.aiError)
    } catch (err: any) {
      setAiError(err.message)
      // Initialize empty mappings
      const empty: Record<string, null> = {}
      sourceColumns.forEach((col) => { empty[col] = null })
      setMapping(empty)
    } finally {
      setLoading(false)
    }
  }

  const updateMapping = (sourceCol: string, targetField: string | null) => {
    setMapping((prev) => ({ ...prev, [sourceCol]: targetField }))
  }

  // Get mapped target fields to prevent double-mapping
  const usedTargets = new Set(Object.values(mapping).filter(Boolean))

  const unmappedRequired = schema
    ? schema.fields.filter((f) => f.required && !usedTargets.has(f.name)).map((f) => f.name)
    : []

  // ---------------------------------------------------------------------------
  // Step 3: Preview & Edit
  // ---------------------------------------------------------------------------
  const loadPreview = () => {
    if (!schema || !sampleData.length) return
    const reverseMap: Record<string, string> = {}
    for (const [src, tgt] of Object.entries(mapping)) {
      if (tgt) reverseMap[tgt] = src
    }
    const preview = sampleData.map((row, i) => {
      const transformed: Record<string, any> = { _rowNum: i + 1 }
      schema.fields.forEach((f) => {
        const srcCol = reverseMap[f.name]
        const edits = editedRows[i]
        if (edits && edits[f.name] !== undefined) {
          transformed[f.name] = edits[f.name]
        } else if (srcCol && row[srcCol] !== undefined) {
          transformed[f.name] = row[srcCol]
        } else {
          transformed[f.name] = ""
        }
      })
      return transformed
    })
    setPreviewData(preview)
  }

  const handleCellEdit = (rowIdx: number, field: string, value: string) => {
    setEditedRows((prev) => ({
      ...prev,
      [rowIdx]: { ...(prev[rowIdx] || {}), [field]: value },
    }))
    // Update preview in place
    setPreviewData((prev) => {
      const next = [...prev]
      if (next[rowIdx]) next[rowIdx] = { ...next[rowIdx], [field]: value }
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Step 4: Validate
  // ---------------------------------------------------------------------------
  const runValidation = async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const res = await fetch("/api/data-import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, mapping, editedRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Validation failed")
      setValidation(data)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Validation Failed", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: Commit
  // ---------------------------------------------------------------------------
  const runImport = async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const res = await fetch("/api/data-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, mapping, editedRows, skipErrorRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import failed")
      setImportResult(data)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import Failed", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const resetWizard = () => {
    setStep(1)
    setEntityType("")
    setSelectedFile(null)
    setJobId(null)
    setSourceColumns([])
    setSampleData([])
    setTotalRows(0)
    setMapping({})
    setConfidence({})
    setSplitFields([])
    setAiError(null)
    setPreviewData([])
    setEditedRows({})
    setValidation(null)
    setImportResult(null)
    setSkipErrorRows(false)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-emerald-600" />
          Data Import
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import data from your previous ERP system using CSV, Excel, or PDF files
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = step === s.id
          const isDone = step > s.id
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <div className={cn("h-px w-6 sm:w-10", isDone ? "bg-primary" : "bg-border")} />}
              <div className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                isActive ? "bg-primary text-primary-foreground" :
                isDone ? "bg-primary/10 text-primary" :
                "bg-muted text-muted-foreground"
              )}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="border rounded-lg bg-card p-6 min-h-[400px]">
        {/* ================================================================ */}
        {/* Step 1: Select Entity + Upload */}
        {/* ================================================================ */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Select data type and upload file</h2>
              <p className="text-sm text-muted-foreground">Choose what type of data you're importing, then upload your file.</p>
            </div>

            {/* Entity selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">What are you importing?</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ENTITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const selected = entityType === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setEntityType(opt.key)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                        selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", opt.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* File upload */}
            {entityType && (
              <div>
                <label className="text-sm font-medium mb-3 block">Upload file</label>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                    dragOver ? "border-primary bg-primary/5" :
                    selectedFile ? "border-green-400 bg-green-50 dark:bg-green-950/20" :
                    "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleFileSelect(file)
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                        className="ml-2 p-1 rounded hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm font-medium">Drop your file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports CSV, Excel (.xlsx/.xls), and PDF — Max 20MB</p>
                    </>
                  )}
                </div>

                {/* PDF warning */}
                {selectedFile?.name.toLowerCase().endsWith(".pdf") && (
                  <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      PDF table extraction is best-effort. For most reliable results, export your data as CSV or Excel from your old system.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Upload button */}
            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!entityType || !selectedFile || loading}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                Upload & Continue
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Step 2: Column Mapping */}
        {/* ================================================================ */}
        {step === 2 && schema && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Map columns to {schema.label} fields</h2>
              <p className="text-sm text-muted-foreground">
                AI has suggested mappings below. Review and adjust as needed.
              </p>
            </div>

            {aiError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">{aiError}</p>
              </div>
            )}

            {unmappedRequired.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                    Required fields not yet mapped:
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400">{unmappedRequired.join(", ")}</p>
                </div>
              </div>
            )}

            {splitFields.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  AI detected columns that may need splitting: {splitFields.map((s: any) => `"${s.sourceColumn}" → ${s.targetFields.join(" + ")}`).join("; ")}. Name splitting will be handled automatically during import.
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">AI is analyzing your columns...</span>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-2.5 font-medium">Source Column</th>
                      <th className="text-left px-4 py-2.5 font-medium">Sample Value</th>
                      <th className="text-left px-4 py-2.5 font-medium">Maps To</th>
                      <th className="px-4 py-2.5 font-medium w-16 text-center">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceColumns.map((col) => {
                      const target = mapping[col]
                      const conf = confidence[col] ?? 0
                      const sample = sampleData[0]?.[col] || ""
                      return (
                        <tr key={col} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{col}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">{sample}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={target || ""}
                              onChange={(e) => updateMapping(col, e.target.value || null)}
                              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="">— Skip this column —</option>
                              {schema.fields.map((f) => (
                                <option
                                  key={f.name}
                                  value={f.name}
                                  disabled={usedTargets.has(f.name) && mapping[col] !== f.name}
                                >
                                  {f.name} {f.required ? "*" : ""} — {f.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {target ? (
                              <span className={cn(
                                "inline-block w-2.5 h-2.5 rounded-full",
                                conf >= 0.8 ? "bg-green-500" :
                                conf >= 0.5 ? "bg-yellow-500" :
                                "bg-red-500"
                              )} title={`${Math.round(conf * 100)}% confidence`} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="rounded-lg border px-4 py-2 text-sm flex items-center gap-1 hover:bg-muted">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => { loadPreview(); setStep(3) }}
                disabled={loading || unmappedRequired.length > 0}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 flex items-center gap-2"
              >
                Preview Data <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Step 3: Preview & Edit */}
        {/* ================================================================ */}
        {step === 3 && schema && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Preview mapped data</h2>
              <p className="text-sm text-muted-foreground">
                Showing first {Math.min(previewData.length, 5)} of {totalRows} rows. Click any cell to edit.
              </p>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-xs">#</th>
                    {schema.fields.filter((f) => Object.values(mapping).includes(f.name) || f.required).map((f) => (
                      <th key={f.name} className="px-3 py-2 text-left font-medium text-xs whitespace-nowrap">
                        {f.name} {f.required && <span className="text-red-500">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground text-xs">{row._rowNum}</td>
                      {schema.fields.filter((f) => Object.values(mapping).includes(f.name) || f.required).map((f) => (
                        <td key={f.name} className="px-3 py-1.5">
                          <input
                            type="text"
                            value={row[f.name] ?? ""}
                            onChange={(e) => handleCellEdit(i, f.name, e.target.value)}
                            className={cn(
                              "w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary bg-transparent",
                              f.required && !row[f.name] ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-transparent hover:border-border"
                            )}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="rounded-lg border px-4 py-2 text-sm flex items-center gap-1 hover:bg-muted">
                <ChevronLeft className="h-4 w-4" /> Back to Mapping
              </button>
              <button
                onClick={() => { setStep(4); runValidation() }}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 flex items-center gap-2"
              >
                Validate All <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Step 4: Validation Results */}
        {/* ================================================================ */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Validation Results</h2>
              <p className="text-sm text-muted-foreground">Review validation results before importing.</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Validating {totalRows} rows...</span>
              </div>
            ) : validation ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="border rounded-lg p-3">
                    <p className="text-2xl font-bold">{validation.totalRows}</p>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="border rounded-lg p-3 border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <p className="text-2xl font-bold text-green-600">{validation.validRows}</p>
                    <p className="text-xs text-muted-foreground">Valid Rows</p>
                  </div>
                  <div className="border rounded-lg p-3 border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <p className="text-2xl font-bold text-red-600">{validation.errorCount}</p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </div>
                  <div className="border rounded-lg p-3 border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
                    <p className="text-2xl font-bold text-yellow-600">{validation.warningCount}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                </div>

                {/* FK resolution */}
                {validation.foreignKeyResolution && (validation.foreignKeyResolution.resolved > 0 || validation.foreignKeyResolution.unresolved.length > 0) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-2">Reference Resolution</h3>
                    <p className="text-xs text-muted-foreground">
                      {validation.foreignKeyResolution.resolved} references resolved successfully.
                      {validation.foreignKeyResolution.unresolved.length > 0 &&
                        ` ${validation.foreignKeyResolution.unresolved.length} could not be resolved.`}
                    </p>
                    {validation.foreignKeyResolution.unresolved.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-auto">
                        {validation.foreignKeyResolution.unresolved.slice(0, 10).map((u, i) => (
                          <p key={i} className="text-xs text-red-600">
                            Row {u.row}: {u.field} = "{u.value}" not found
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Error list */}
                {validation.errors.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-2">
                      Issues ({validation.errors.length}{validation.errors.length >= 200 ? "+" : ""})
                    </h3>
                    <div className="max-h-48 overflow-auto space-y-1">
                      {validation.errors.slice(0, 50).map((e, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-2 text-xs p-1.5 rounded",
                            e.severity === "error" ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400" :
                            "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400"
                          )}
                        >
                          <span className="font-mono shrink-0">Row {e.row}</span>
                          <span className="font-medium shrink-0">{e.field}:</span>
                          <span>{e.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skip errors option */}
                {validation.errorCount > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skipErrorRows}
                      onChange={(e) => setSkipErrorRows(e.target.checked)}
                      className="rounded border-muted-foreground/30"
                    />
                    Skip {validation.errorCount} rows with errors and import the rest
                  </label>
                )}
              </>
            ) : null}

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="rounded-lg border px-4 py-2 text-sm flex items-center gap-1 hover:bg-muted">
                <ChevronLeft className="h-4 w-4" /> Edit Data
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={loading || !validation || (validation.errorCount > 0 && !skipErrorRows)}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 flex items-center gap-2"
              >
                Proceed to Import <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Step 5: Confirm & Import */}
        {/* ================================================================ */}
        {step === 5 && (
          <div className="space-y-6">
            {!importResult ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Confirm Import</h2>
                  <p className="text-sm text-muted-foreground">Review the summary below and confirm to start the import.</p>
                </div>

                <div className="border rounded-lg p-6 max-w-lg mx-auto space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Data Type</p>
                      <p className="font-medium">{schema?.label}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">File</p>
                      <p className="font-medium truncate">{selectedFile?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Rows</p>
                      <p className="font-medium">{totalRows}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Will Import</p>
                      <p className="font-medium text-green-600">
                        {skipErrorRows ? (validation?.validRows ?? totalRows) : totalRows} records
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        This will create new {schema?.label.toLowerCase()} records in your database.
                        {schema?.entityType === "staff" && " Imported staff will receive temporary passwords and must change them on first login."}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={runImport}
                    disabled={loading}
                    className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing... Please wait
                      </>
                    ) : (
                      <>
                        <DatabaseZap className="h-4 w-4" />
                        Confirm & Import Data
                      </>
                    )}
                  </button>
                </div>

                <div className="flex justify-start">
                  <button onClick={() => setStep(4)} className="rounded-lg border px-4 py-2 text-sm flex items-center gap-1 hover:bg-muted">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                </div>
              </>
            ) : (
              /* Import result */
              <div className="max-w-lg mx-auto text-center space-y-6">
                {importResult.success ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Import Complete!</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {importResult.imported} {schema?.label.toLowerCase()} imported successfully.
                        {importResult.skipped > 0 && ` ${importResult.skipped} rows skipped.`}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto">
                      <X className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Import Failed</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {importResult.imported} imported, {importResult.skipped} failed.
                      </p>
                    </div>
                  </>
                )}

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="border rounded-lg p-3">
                    <p className="text-lg font-bold">{importResult.totalRows}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="border rounded-lg p-3 border-green-200">
                    <p className="text-lg font-bold text-green-600">{importResult.imported}</p>
                    <p className="text-xs text-muted-foreground">Imported</p>
                  </div>
                  <div className="border rounded-lg p-3 border-red-200">
                    <p className="text-lg font-bold text-red-600">{importResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="border rounded-lg p-4 text-left">
                    <h3 className="text-sm font-medium mb-2">Error Log</h3>
                    <div className="max-h-40 overflow-auto space-y-1">
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">
                          Row {e.row}: {e.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center gap-3">
                  <button onClick={resetWizard} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                    Import Another File
                  </button>
                  <a
                    href={`/${entityType === "inventory" ? "inventory" : entityType}`}
                    className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted inline-flex items-center gap-1"
                  >
                    View {schema?.label} <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
