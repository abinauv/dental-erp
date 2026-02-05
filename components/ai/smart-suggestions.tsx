"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAI, type Suggestion } from "./ai-provider"
import { cn } from "@/lib/utils"

const URGENCY_STYLES: Record<string, string> = {
  normal: "border-muted bg-muted/50 text-foreground",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
}

/**
 * SmartSuggestions — a horizontal bar that appears on pages with contextual
 * AI-generated suggestions. Loads automatically on mount.
 */
export function SmartSuggestions({ patientId }: { patientId?: string }) {
  const pathname = usePathname()
  const { suggestions, loadSuggestions } = useAI()
  const [executing, setExecuting] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const { executeCommand } = useAI()

  useEffect(() => {
    loadSuggestions(pathname, patientId)
  }, [pathname, patientId, loadSuggestions])

  if (suggestions.length === 0) return null

  const handleAction = async (suggestion: Suggestion) => {
    setExecuting(suggestion.action)
    setFeedback(null)
    const result = await executeCommand(suggestion.title, { patientId, page: pathname })
    if (result?.result?.message) {
      setFeedback(result.result.message)
    } else if (result?.result?.success) {
      setFeedback("Done!")
    }
    setExecuting(null)
    // Auto-clear feedback
    setTimeout(() => setFeedback(null), 4000)
  }

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2 flex-wrap">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border px-3 py-2 max-w-xs transition-colors",
              URGENCY_STYLES[s.urgency] || URGENCY_STYLES.normal
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">{s.title}</p>
                <p className="text-xs opacity-70 mt-0.5">{s.description}</p>
              </div>
            </div>
            <button
              onClick={() => handleAction(s)}
              disabled={executing === s.action}
              className="mt-2 text-xs underline underline-offset-2 hover:no-underline disabled:opacity-40 transition-opacity"
            >
              {executing === s.action ? "Working…" : "Do this →"}
            </button>
          </div>
        ))}
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2">
          {feedback}
        </div>
      )}
    </div>
  )
}
