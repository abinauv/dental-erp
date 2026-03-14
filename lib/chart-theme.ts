/**
 * Theme-aware chart colors using CSS variables.
 * These resolve to the --chart-N variables defined in globals.css.
 */
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
]

/** Semantic chart colors for common use cases */
export const CHART_SEMANTIC = {
  primary: "hsl(var(--primary))",
  success: "hsl(160, 60%, 45%)",
  warning: "hsl(35, 92%, 55%)",
  danger: "hsl(0, 84%, 60%)",
  info: "hsl(210, 60%, 50%)",
  muted: "hsl(var(--muted-foreground))",
} as const
