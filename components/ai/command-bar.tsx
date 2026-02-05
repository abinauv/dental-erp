"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import { useAI } from "./ai-provider"
import { cn } from "@/lib/utils"

export function CommandBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<any>(null)
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const { executeCommand, commandLoading } = useAI()

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
        setQuery("")
        setResult(null)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || commandLoading) return
    setResult(null)
    const res = await executeCommand(query.trim(), { page: pathname })
    if (res) {
      setResult(res)
      setHistory((prev) => [query.trim(), ...prev.slice(0, 9)])
    }
  }, [query, commandLoading, executeCommand, pathname])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-lg border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="text-muted-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResult(null) }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit()
              if (e.key === "Escape") setOpen(false)
            }}
            placeholder="Type a command… e.g. 'Book appointment for Raj Kumar tomorrow at 10am'"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">ESC</span>
        </div>

        {/* Quick examples (shown when no query) */}
        {!query && !result && (
          <div className="p-3">
            <p className="mb-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">Quick commands</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Show today's appointments",
                "Check stock for composite resin",
                "Show this month's revenue",
                "Check overdue invoices",
                "Low stock alerts",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="rounded-md border px-3 py-1 text-xs hover:bg-muted transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>

            {/* Recent history */}
            {history.length > 0 && (
              <>
                <p className="mt-3 mb-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">Recent</p>
                <div className="flex flex-col gap-1">
                  {history.slice(0, 5).map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(item)}
                      className="text-left text-sm px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading */}
        {commandLoading && (
          <div className="flex items-center gap-2 px-4 py-3 border-t">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span className="text-sm text-muted-foreground">Processing…</span>
          </div>
        )}

        {/* Result */}
        {result && !commandLoading && (
          <div className="border-t p-4 max-h-64 overflow-auto">
            {/* Summary */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {result.intent?.replace(/_/g, " ")}
              </span>
              {result.requiresApproval && (
                <span className="rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5">Needs approval</span>
              )}
            </div>

            {/* Result content */}
            {result.result?.type === "general" ? (
              <p className="text-sm leading-relaxed">{result.result.message}</p>
            ) : result.result?.success ? (
              <div className="text-sm space-y-2">
                {result.result.message && <p className="text-emerald-700 font-medium">{result.result.message}</p>}
                {result.result.summary && (
                  <pre className="whitespace-pre-wrap text-xs bg-muted rounded p-2">
                    {JSON.stringify(result.result.summary, null, 2)}
                  </pre>
                )}
                {result.result.appointments && (
                  <div className="space-y-1">
                    {result.result.appointments.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs bg-muted rounded px-2 py-1">
                        <span>{a.time} – {a.patient}</span>
                        <span className="text-muted-foreground">{a.doctor} • {a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.result.items && (
                  <div className="space-y-1">
                    {result.result.items.map((item: any, i: number) => (
                      <div key={i} className={cn("flex justify-between text-xs rounded px-2 py-1",
                        item.status === "Critical" ? "bg-red-50" : item.status === "Low" ? "bg-amber-50" : "bg-emerald-50"
                      )}>
                        <span>{item.name}</span>
                        <span className="font-medium">{item.stock} – {item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.result.invoices && (
                  <div className="space-y-1">
                    {result.result.invoices.map((inv: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs bg-red-50 rounded px-2 py-1">
                        <span>{inv.patient} ({inv.invoiceNo})</span>
                        <span className="font-medium text-red-700">{inv.balance}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-600">{result.result?.message || "No result"}</p>
            )}
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>Enter to execute • ESC to close</span>
          <span>Powered by AI</span>
        </div>
      </div>
    </div>
  )
}
