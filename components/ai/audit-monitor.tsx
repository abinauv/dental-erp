"use client"

import { useState, useEffect, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SuspiciousPattern {
  pattern: string
  severity: "low" | "medium" | "high"
  affectedUsers?: string[]
  occurrences?: number
  recommendation: string
}

interface AuditAnalysis {
  suspicious: SuspiciousPattern[]
  summary: string
}

const SEVERITY_STYLES: Record<string, string> = {
  low:    "bg-blue-50 border-blue-200 text-blue-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  high:   "bg-red-50 border-red-200 text-red-800",
}

/**
 * AuditMonitor — Audit-log intelligence panel (Phase 8.10).
 * Calls POST /api/ai/clinical { type: "audit_analysis" } and surfaces
 * suspicious patterns with severity-coded cards.
 * Rendered on the Settings → Security page (or standalone).
 */
export function AuditMonitor() {
  const [analysis, setAnalysis] = useState<AuditAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysBack, setDaysBack] = useState(7)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/clinical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "audit_analysis", daysBack }),
      })
      const data = await res.json()
      if (data.success) setAnalysis(data.data)
    } catch {
      // silent – component just won't render
    } finally {
      setLoading(false)
    }
  }, [daysBack])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      {/* header + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🛡️</span>
          <h3 className="text-sm font-semibold">Audit Log Intelligence</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="text-xs border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={load} disabled={loading} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ↻
          </button>
        </div>
      </div>

      {/* loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-primary" />
          <span>Analysing audit logs…</span>
        </div>
      )}

      {/* summary sentence */}
      {!loading && analysis && (
        <p className="text-xs text-muted-foreground">{analysis.summary}</p>
      )}

      {/* suspicious-pattern cards */}
      {!loading && analysis?.suspicious && analysis.suspicious.length > 0 && (
        <div className="space-y-2">
          {analysis.suspicious.map((p, i) => (
            <div key={i} className={`rounded border p-3 text-xs ${SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.low}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold">{p.pattern}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.severity === "high" ? "bg-red-100" : p.severity === "medium" ? "bg-amber-100" : "bg-blue-100"
                  }`}
                >
                  {p.severity}
                </span>
              </div>
              <p className="opacity-80">{p.recommendation}</p>
              {p.affectedUsers && p.affectedUsers.length > 0 && (
                <p className="mt-1 opacity-60">Affected users: {p.affectedUsers.join(", ")}</p>
              )}
              {p.occurrences != null && (
                <p className="mt-0.5 opacity-60">{p.occurrences} occurrence{p.occurrences !== 1 ? "s" : ""}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* clean bill of health */}
      {!loading && analysis?.suspicious && analysis.suspicious.length === 0 && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded border border-emerald-200 px-3 py-2">
          ✓ No suspicious patterns detected in the last {daysBack} day{daysBack !== 1 ? "s" : ""}.
        </p>
      )}
    </div>
  )
}
