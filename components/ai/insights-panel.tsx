"use client"

import { useEffect } from "react"
import { useAI, type Insight } from "./ai-provider"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES: Record<string, string> = {
  INFO: "bg-blue-50 border-blue-200 text-blue-800",
  WARNING: "bg-amber-50 border-amber-200 text-amber-800",
  CRITICAL: "bg-red-50 border-red-200 text-red-800",
}

const SEVERITY_BADGE: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
}

const CATEGORY_ICONS: Record<string, string> = {
  REVENUE: "💰",
  CLINICAL: "🏥",
  OPERATIONAL: "⚙️",
  PATIENT: "👤",
  STAFFING: "👥",
  INVENTORY: "📦",
}

function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  return (
    <div className={cn("rounded-lg border p-3", SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.INFO)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[insight.category] || "📌"}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold truncate">{insight.title}</h4>
              <span className={cn("text-xs rounded-full px-2 py-0.5", SEVERITY_BADGE[insight.severity] || SEVERITY_BADGE.INFO)}>
                {insight.severity}
              </span>
            </div>
            <p className="text-xs mt-0.5 leading-relaxed">{insight.description}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Dismiss insight"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * InsightsPanel — renders on the dashboard to show AI-generated insights.
 * Pass `maxItems` to limit how many are shown.
 */
export function InsightsPanel({ maxItems = 4 }: { maxItems?: number }) {
  const { insights, insightsLoading, loadInsights, dismissInsight, generateInsights } = useAI()

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  const visible = insights.slice(0, maxItems)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Insights</h3>
        <button
          onClick={generateInsights}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Loading */}
      {insightsLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span>Loading insights…</span>
        </div>
      )}

      {/* Empty */}
      {!insightsLoading && visible.length === 0 && (
        <p className="text-xs text-muted-foreground">No active insights right now.</p>
      )}

      {/* Insight cards */}
      {visible.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onDismiss={() => dismissInsight(insight.id)} />
      ))}

      {/* More link */}
      {insights.length > maxItems && (
        <p className="text-xs text-muted-foreground">
          +{insights.length - maxItems} more insight{insights.length - maxItems > 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}
