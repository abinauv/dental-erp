"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
type Tab = "drug_check" | "cost_estimate" | "consent_form" | "clinical_notes"

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "drug_check",     label: "Drug Check",     icon: "💊" },
  { id: "cost_estimate",  label: "Cost Estimate",  icon: "💰" },
  { id: "consent_form",   label: "Consent Form",   icon: "📄" },
  { id: "clinical_notes", label: "Notes",          icon: "📝" },
]

export interface TreatmentAssistProps {
  patientId: string
  procedureId?: string
  procedureName?: string
  diagnosis?: string
  findings?: string
  procedureNotes?: string
  medications?: string[]
}

/**
 * TreatmentAssist — four-in-one AI panel rendered on the new-treatment form
 * once both a patient and a procedure are selected.
 *
 * Tabs:
 *   Drug Check      – interaction / allergy check against patient history
 *   Cost Estimate   – AI cost breakdown for the selected procedure(s)
 *   Consent Form    – generated consent in English / Tamil / Hindi
 *   Clinical Notes  – expands brief doctor notes into structured docs
 */
export function TreatmentAssist({
  patientId,
  procedureId,
  procedureName,
  diagnosis,
  findings,
  procedureNotes,
  medications,
}: TreatmentAssistProps) {
  const [activeTab, setActiveTab] = useState<Tab>("drug_check")
  const [loading, setLoading] = useState<Tab | null>(null)
  const [results, setResults] = useState<Record<string, Record<string, unknown>>>({})

  // Drug-check input lives here so it persists across tab switches
  const [drugInput, setDrugInput] = useState("")
  // Consent-form language selector
  const [language, setLanguage] = useState("English")

  // ---------------------------------------------------------------------------
  const callClinical = useCallback(
    async (type: string, body: Record<string, unknown>) => {
      setLoading(type as Tab)
      try {
        const res = await fetch("/api/ai/clinical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, patientId, ...body }),
        })
        const data = await res.json()
        setResults((prev) => ({
          ...prev,
          [type]: data.success ? data.data : { error: data.error || "Request failed" },
        }))
      } catch {
        setResults((prev) => ({ ...prev, [type]: { error: "Network error" } }))
      } finally {
        setLoading(null)
      }
    },
    [patientId]
  )

  // Auto-fetch on tab switch (except drug_check which needs user input)
  const handleTab = (tab: Tab) => {
    setActiveTab(tab)
    if (tab === "cost_estimate" && !results.cost_estimate && procedureId) {
      callClinical("cost_estimate", { procedureIds: [procedureId], treatmentPlan: procedureNotes })
    }
    if (tab === "consent_form" && !results.consent_form) {
      callClinical("consent_form", { procedureName, procedureId, language })
    }
    if (tab === "clinical_notes" && !results.clinical_notes) {
      callClinical("clinical_notes", { briefNotes: procedureNotes, procedureName, diagnosis, findings })
    }
  }

  const result = results[activeTab] || {}
  const isLoading = loading === activeTab

  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-lg border">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <span>🤖</span>
        <span className="text-xs font-semibold">AI Treatment Assistant</span>
      </div>

      {/* tab bar */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* panel body */}
      <div className="p-3">
        {activeTab === "drug_check" && (
          <DrugCheck
            loading={isLoading}
            result={result}
            drugInput={drugInput}
            setDrugInput={setDrugInput}
            onCheck={() => callClinical("drug_check", { medications, newMedication: drugInput })}
          />
        )}
        {activeTab === "cost_estimate" && (
          <CostEstimate
            loading={isLoading}
            result={result}
            onRetry={() =>
              callClinical("cost_estimate", {
                procedureIds: procedureId ? [procedureId] : [],
                treatmentPlan: procedureNotes,
              })
            }
          />
        )}
        {activeTab === "consent_form" && (
          <ConsentForm
            loading={isLoading}
            result={result}
            language={language}
            setLanguage={setLanguage}
            onGenerate={() => callClinical("consent_form", { procedureName, procedureId, language })}
          />
        )}
        {activeTab === "clinical_notes" && (
          <ClinicalNotes
            loading={isLoading}
            result={result}
            onExpand={() =>
              callClinical("clinical_notes", { briefNotes: procedureNotes, procedureName, diagnosis, findings })
            }
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared micro-components
// ---------------------------------------------------------------------------
function Spinner() {
  return (
    <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
      <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-primary" />
      <span>Analyzing…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drug Check panel
// ---------------------------------------------------------------------------
function DrugCheck({
  loading,
  result,
  drugInput,
  setDrugInput,
  onCheck,
}: {
  loading: boolean
  result: Record<string, unknown>
  drugInput: string
  setDrugInput: (v: string) => void
  onCheck: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter a medication to check against the patient&apos;s history.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={drugInput}
          onChange={(e) => setDrugInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onCheck() }}
          placeholder="e.g. Amoxicillin 500 mg"
          className="flex-1 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={onCheck}
          disabled={loading || !drugInput.trim()}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          Check
        </button>
      </div>

      {loading && <Spinner />}
      {result.error && <p className="text-xs text-red-600">{String(result.error)}</p>}

      {!loading && !result.error && result.safe !== undefined && (
        <div className="space-y-2">
          <p className={cn("text-xs font-semibold", result.safe ? "text-emerald-700" : "text-red-700")}>
            {result.safe ? "✓ No interactions detected" : "⚠ Interactions detected"}
          </p>

          {(result.interactions as any[])?.map((interaction, i) => (
            <div
              key={i}
              className={cn(
                "rounded p-2 text-xs",
                interaction.severity === "high"
                  ? "bg-red-50 text-red-800"
                  : interaction.severity === "moderate"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-muted"
              )}
            >
              <p className="font-semibold">{interaction.drugs}</p>
              <p className="opacity-80">{interaction.description}</p>
            </div>
          ))}

          {(result.allergies as any[])?.map((a, i) => (
            <p key={i} className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
              🚫 Allergy: {a.allergen} — {a.reaction}
            </p>
          ))}

          {(result.recommendations as string[])?.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Recommendations: {(result.recommendations as string[]).join("; ")}
            </p>
          )}

          <p className="text-xs text-muted-foreground italic mt-1">⚠ AI-generated — for doctor review only.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cost Estimate panel
// ---------------------------------------------------------------------------
function CostEstimate({
  loading,
  result,
  onRetry,
}: {
  loading: boolean
  result: Record<string, unknown>
  onRetry: () => void
}) {
  return (
    <div className="space-y-3">
      {!result.lineItems && !loading && (
        <button onClick={onRetry} className="text-xs text-primary hover:underline">
          Generate cost estimate
        </button>
      )}
      {loading && <Spinner />}
      {result.error && <p className="text-xs text-red-600">{String(result.error)}</p>}

      {!loading && !result.error && result.lineItems && (
        <div className="space-y-1.5">
          {(result.lineItems as any[]).map((item, i) => (
            <div key={i} className="flex justify-between text-xs border-b pb-1">
              <span>
                {item.description}
                {item.quantity > 1 && <span className="text-muted-foreground ml-1">×{item.quantity}</span>}
              </span>
              <span className="font-medium">₹{Number(item.total).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>Subtotal</span>
            <span>₹{Number(result.subtotal || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>GST (12%)</span>
            <span>₹{Number(result.gst || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-1.5 mt-1">
            <span>Total</span>
            <span>₹{Number(result.grandTotal || 0).toLocaleString()}</span>
          </div>
          {result.notes && <p className="text-xs text-muted-foreground italic mt-1">{String(result.notes)}</p>}
          <p className="text-xs text-muted-foreground italic">⚠ AI estimate — subject to change at billing.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Consent Form panel
// ---------------------------------------------------------------------------
function ConsentForm({
  loading,
  result,
  language,
  setLanguage,
  onGenerate,
}: {
  loading: boolean
  result: Record<string, unknown>
  language: string
  setLanguage: (l: string) => void
  onGenerate: () => void
}) {
  const downloadText = () => {
    const lines = [
      String(result.title || "Consent Form"),
      "",
      `Patient: ${result.patientName}`,
      `Hospital: ${result.hospitalName}`,
      `Procedure: ${result.procedureName}`,
      "",
      String(result.description || ""),
      "",
      "Risks:",
      ...((result.risks as string[]) || []).map((r) => `  • ${r}`),
      "",
      "Benefits:",
      ...((result.benefits as string[]) || []).map((b) => `  • ${b}`),
      "",
      "Alternatives:",
      ...((result.alternatives as string[]) || []).map((a) => `  • ${a}`),
      "",
      String(result.acknowledgement || ""),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "consent-form.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Language:</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="text-xs border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="English">English</option>
          <option value="Tamil">Tamil</option>
          <option value="Hindi">Hindi</option>
        </select>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="ml-auto text-xs text-primary hover:underline disabled:opacity-40"
        >
          {result.title ? "Regenerate" : "Generate"}
        </button>
      </div>

      {loading && <Spinner />}
      {result.error && <p className="text-xs text-red-600">{String(result.error)}</p>}

      {!loading && !result.error && result.title && (
        <>
          <div className="rounded border bg-muted/30 p-3 max-h-48 overflow-auto text-xs space-y-2">
            <p className="font-bold text-center text-sm">{result.title}</p>
            <p><strong>Patient:</strong> {String(result.patientName)}</p>
            <p><strong>Hospital:</strong> {String(result.hospitalName)}</p>
            <p><strong>Procedure:</strong> {String(result.procedureName)}</p>
            <p>{String(result.description)}</p>

            {(result.risks as string[])?.length > 0 && (
              <>
                <p className="font-semibold mt-2">Risks:</p>
                {(result.risks as string[]).map((r, i) => <p key={i}>• {r}</p>)}
              </>
            )}
            {(result.benefits as string[])?.length > 0 && (
              <>
                <p className="font-semibold mt-2">Benefits:</p>
                {(result.benefits as string[]).map((b, i) => <p key={i}>• {b}</p>)}
              </>
            )}
            {(result.alternatives as string[])?.length > 0 && (
              <>
                <p className="font-semibold mt-2">Alternatives:</p>
                {(result.alternatives as string[]).map((a, i) => <p key={i}>• {a}</p>)}
              </>
            )}
            {result.acknowledgement && <p className="mt-2 italic">{String(result.acknowledgement)}</p>}
          </div>
          <button onClick={downloadText} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ⬇ Download
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Clinical Notes panel
// ---------------------------------------------------------------------------
function ClinicalNotes({
  loading,
  result,
  onExpand,
}: {
  loading: boolean
  result: Record<string, unknown>
  onExpand: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Expand brief notes into structured clinical documentation.</p>
        <button onClick={onExpand} disabled={loading} className="text-xs text-primary hover:underline disabled:opacity-40">
          {result.expandedNotes ? "Re-expand" : "Expand notes"}
        </button>
      </div>

      {loading && <Spinner />}
      {result.error && <p className="text-xs text-red-600">{String(result.error)}</p>}

      {!loading && !result.error && result.expandedNotes && (
        <div className="space-y-2 text-xs">
          {result.diagnosis && (
            <div>
              <p className="font-semibold text-muted-foreground">Diagnosis</p>
              <p className="bg-muted rounded p-2">{String(result.diagnosis)}</p>
            </div>
          )}
          {result.findings && (
            <div>
              <p className="font-semibold text-muted-foreground">Findings</p>
              <p className="bg-muted rounded p-2">{String(result.findings)}</p>
            </div>
          )}
          {result.procedureNotes && (
            <div>
              <p className="font-semibold text-muted-foreground">Procedure Notes</p>
              <p className="bg-muted rounded p-2">{String(result.procedureNotes)}</p>
            </div>
          )}
          {result.recommendations && (
            <div>
              <p className="font-semibold text-muted-foreground">Recommendations</p>
              <p className="bg-muted rounded p-2">{String(result.recommendations)}</p>
            </div>
          )}
          <p className="text-muted-foreground italic">⚠ AI-assisted — review and edit before saving.</p>
        </div>
      )}
    </div>
  )
}
