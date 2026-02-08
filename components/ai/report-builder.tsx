"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXAMPLE_QUERIES = [
  "Monthly revenue by procedure for last 3 months",
  "Patients who haven't visited in 6 months",
  "Overdue invoices sorted by amount",
  "Appointment no-show rate by day of week",
  "Top 5 most performed procedures this quarter",
  "Inventory items running low on stock",
]

interface QueryResult {
  /** Set by our fetch handler */
  success: boolean
  /** Rows returned from /api/ai/query */
  rows?: Record<string, unknown>[]
  columns?: string[]
  summary?: string
  rowCount?: number
  model?: string
  error?: string
}

/**
 * ReportBuilder — Natural-language report builder (Phase 3.5 / 8.9).
 * Sends queries to POST /api/ai/query (whitelisted builders) and renders
 * results as a dynamic table.  Supports exporting results as JSON.
 */
export function ReportBuilder() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  // ---------------------------------------------------------------
  const execute = useCallback(async () => {
    if (!query.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, ...data })
      } else {
        setResult({ success: false, error: data.error || "Query failed" })
      }
      setHistory((prev) => [query.trim(), ...prev.filter((h) => h !== query.trim())].slice(0, 10))
    } catch {
      setResult({ success: false, error: "Failed to execute query" })
    } finally {
      setLoading(false)
    }
  }, [query, loading])

  // ---------------------------------------------------------------
  const exportJSON = () => {
    if (!result?.rows) return
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "report.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Derive column headers from first row if /api/ai/query doesn't return them
  const columns = result?.columns || (result?.rows?.[0] ? Object.keys(result.rows[0]) : [])

  // ---------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* header */}
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>🤖</span> Natural Language Report Builder
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions in plain English — AI queries your data and returns results.
        </p>
      </div>

      {/* input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResult(null) }}
          onKeyDown={(e) => { if (e.key === "Enter") execute() }}
          placeholder="e.g. 'Show revenue by procedure for last month'"
          className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
        <button
          onClick={execute}
          disabled={loading || !query.trim()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {/* example chips */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setQuery(ex); setResult(null) }}
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* recent history (shown when idle) */}
      {history.length > 0 && !result && !loading && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Recent queries</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {history.slice(0, 5).map((h, i) => (
              <button
                key={i}
                onClick={() => { setQuery(h); setResult(null) }}
                className="text-xs text-primary/60 hover:text-primary transition-colors underline underline-offset-2"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span>Querying your data…</span>
        </div>
      )}

      {/* result block */}
      {result && !loading && (
        <div className="rounded-lg border overflow-hidden">
          {/* AI narrative summary */}
          {result.summary && (
            <div className="p-3 bg-primary/5 border-b">
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* error */}
          {!result.success && (
            <div className="p-3 text-sm text-red-600">{result.error || "Query failed"}</div>
          )}

          {/* data table */}
          {result.success && result.rows && result.rows.length > 0 && (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    {columns.map((col) => (
                      <th key={col} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className={cn("border-t", i % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                          {String(row[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* empty state */}
          {result.success && (!result.rows || result.rows.length === 0) && (
            <div className="p-3 text-sm text-muted-foreground">No results found for this query.</div>
          )}

          {/* export button */}
          {result.success && result.rows && result.rows.length > 0 && (
            <div className="p-2 border-t flex justify-end">
              <button onClick={exportJSON} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                ⬇ Export JSON
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
