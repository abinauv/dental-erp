"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface ShortcutMap {
  [key: string]: () => void
}

/**
 * Global keyboard shortcuts for the dashboard.
 * Disabled when user is typing in an input/textarea/contenteditable.
 */
export function useKeyboardShortcuts(extraShortcuts?: ShortcutMap) {
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return

      // Don't interfere with modifier combos except our own
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      // Extra (page-specific) shortcuts
      if (extraShortcuts?.[key]) {
        e.preventDefault()
        extraShortcuts[key]()
        return
      }

      // Global shortcuts
      switch (key) {
        case "g":
          // 'g' then next key for go-to navigation (vim-style)
          // We'll use simple single-key shortcuts instead
          break
        case "?":
          // Show shortcut help - could open a modal
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [router, extraShortcuts])
}

/**
 * Listen for a specific key combo (e.g. "ctrl+k", "escape", "n")
 */
export function useHotkey(key: string, callback: () => void, deps: unknown[] = []) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target.tagName

      // Escape always works, even in inputs
      if (key === "escape" && e.key === "Escape") {
        e.preventDefault()
        callback()
        return
      }

      // Other keys don't fire inside inputs
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return

      const parts = key.toLowerCase().split("+")
      const mainKey = parts[parts.length - 1]
      const needsCtrl = parts.includes("ctrl") || parts.includes("meta")
      const needsShift = parts.includes("shift")
      const needsAlt = parts.includes("alt")

      if (
        e.key.toLowerCase() === mainKey &&
        (needsCtrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey)) &&
        (needsShift ? e.shiftKey : !e.shiftKey) &&
        (needsAlt ? e.altKey : !e.altKey)
      ) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, callback, ...deps])
}
