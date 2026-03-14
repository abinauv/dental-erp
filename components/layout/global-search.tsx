"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Search,
  Users,
  Calendar,
  Receipt,
  UserCog,
  Stethoscope,
  Loader2,
  ArrowRight,
} from "lucide-react"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

interface SearchResult {
  id: string
  label: string
  sublabel: string
  href: string
}

interface SearchResults {
  patients: SearchResult[]
  appointments: SearchResult[]
  invoices: SearchResult[]
  staff: SearchResult[]
  treatments: SearchResult[]
}

const CATEGORIES = [
  { key: "patients" as const, label: "Patients", icon: Users },
  { key: "appointments" as const, label: "Appointments", icon: Calendar },
  { key: "invoices" as const, label: "Invoices", icon: Receipt },
  { key: "staff" as const, label: "Staff", icon: UserCog },
  { key: "treatments" as const, label: "Treatments", icon: Stethoscope },
]

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Flatten results into a single ordered list for keyboard navigation
  const flatResults = results
    ? CATEGORIES.flatMap((cat) =>
        (results[cat.key] || []).map((r) => ({ ...r, category: cat.key }))
      )
    : []

  // Keyboard shortcut: "/" to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !open &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery("")
      setResults(null)
      setActiveIndex(-1)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length >= 2) {
      setLoading(true)
      debounceRef.current = setTimeout(() => search(value), 300)
    } else {
      setResults(null)
      setLoading(false)
    }
  }

  const navigateTo = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0 && flatResults[activeIndex]) {
      e.preventDefault()
      navigateTo(flatResults[activeIndex].href)
    }
  }

  const totalResults = flatResults.length
  const hasSearched = query.length >= 2 && !loading && results !== null

  return (
    <>
      {/* Trigger — renders in header */}
      <div className="flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden md:flex items-center w-full max-w-sm gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search patients, appointments...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            /
          </kbd>
        </button>
        {/* Mobile: just the icon */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden top-[5%] sm:top-[20%] translate-y-0 mx-2 sm:mx-auto">
          <VisuallyHidden.Root>
            <DialogTitle>Global Search</DialogTitle>
          </VisuallyHidden.Root>

          {/* Search Input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search patients, appointments, invoices, staff, treatments..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Empty state */}
            {query.length < 2 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search across patients, appointments, invoices, staff, and treatments.
              </div>
            )}

            {/* Loading */}
            {query.length >= 2 && loading && !results && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {/* No results */}
            {hasSearched && totalResults === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {/* Grouped results */}
            {results && totalResults > 0 && (
              <div className="py-2">
                {CATEGORIES.map((cat) => {
                  const items = results[cat.key]
                  if (!items || items.length === 0) return null
                  const Icon = cat.icon

                  return (
                    <div key={cat.key}>
                      <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {cat.label}
                      </div>
                      {items.map((item) => {
                        const globalIdx = flatResults.findIndex(
                          (r) => r.id === item.id && r.category === cat.key
                        )
                        const isActive = globalIdx === activeIndex

                        return (
                          <button
                            key={`${cat.key}-${item.id}`}
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isActive ? "bg-accent" : "hover:bg-accent/50"
                            }`}
                            onClick={() => navigateTo(item.href)}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.label}</div>
                              <div className="text-xs text-muted-foreground truncate">{item.sublabel}</div>
                            </div>
                            <ArrowRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {results && totalResults > 0 && (
            <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{totalResults} result{totalResults !== 1 ? "s" : ""}</span>
              <span>
                <kbd className="rounded border px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate
                <kbd className="ml-2 rounded border px-1 py-0.5 font-mono text-[10px]">↵</kbd> open
                <kbd className="ml-2 rounded border px-1 py-0.5 font-mono text-[10px]">esc</kbd> close
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
