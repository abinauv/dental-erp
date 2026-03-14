"use client"

import { useState, useEffect, useCallback } from "react"

interface Duplicate {
  id: string
  patientId: string
  name: string
  confidence: number
  matchFields: string[]
}

/**
 * DuplicateDetector — fuzzy duplicate-patient detection (Phase 8.1).
 * Debounces on prop changes and calls POST /api/ai/clinical { type: "duplicate_check" }.
 * `onSelect` is called with the existing patient's Prisma `id` when the user
 * chooses to use an existing record instead of creating a new one.
 */
export function DuplicateDetector({
  firstName,
  lastName,
  phone,
  email,
  dateOfBirth,
  onSelect,
}: {
  firstName: string
  lastName: string
  phone: string
  email?: string
  dateOfBirth?: string
  onSelect: (existingId: string) => void
}) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    if (!firstName || !lastName || !phone) return
    setChecking(true)
    try {
      const res = await fetch("/api/ai/clinical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "duplicate_check", firstName, lastName, phone, email, dateOfBirth }),
      })
      const data = await res.json()
      setDuplicates(data?.data?.duplicates || [])
    } catch {
      setDuplicates([])
    } finally {
      setChecking(false)
    }
  }, [firstName, lastName, phone, email, dateOfBirth])

  // Debounce: re-run 1.2 s after last prop change
  useEffect(() => {
    const timer = setTimeout(check, 1200)
    return () => clearTimeout(timer)
  }, [check])

  /* ---- spinner while checking ---- */
  if (checking) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <div className="h-3 w-3 animate-spin rounded-full border border-muted border-t-primary" />
        <span>Checking for duplicates…</span>
      </div>
    )
  }

  if (duplicates.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800 mb-2">
        ⚠ Possible duplicate patient{duplicates.length > 1 ? "s" : ""} detected
      </p>
      <div className="space-y-2">
        {duplicates.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between bg-background rounded border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(d.confidence * 100)}% match · matched on {d.matchFields.join(", ")}
              </p>
            </div>
            <button
              onClick={() => onSelect(d.id)}
              className="text-xs rounded-md border border-primary text-primary px-2.5 py-1 hover:bg-primary/10 transition-colors"
            >
              Use existing
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
