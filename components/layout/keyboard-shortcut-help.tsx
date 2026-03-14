"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useHotkey } from "@/hooks/use-keyboard-shortcuts"

const SHORTCUTS = [
  { section: "Navigation", items: [
    { keys: ["/"], description: "Open search" },
    { keys: ["?"], description: "Show keyboard shortcuts" },
  ]},
  { section: "Quick Actions", items: [
    { keys: ["n", "p"], description: "New patient" },
    { keys: ["n", "a"], description: "New appointment" },
    { keys: ["n", "i"], description: "New invoice" },
  ]},
  { section: "General", items: [
    { keys: ["Esc"], description: "Close dialog / modal" },
    { keys: ["Ctrl", "K"], description: "Open AI command bar" },
  ]},
]

export function KeyboardShortcutHelp() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useHotkey("?", () => setOpen(true))

  // Navigation shortcuts
  useHotkey("n", () => {
    // Wait for next key
    const handler = (e: KeyboardEvent) => {
      window.removeEventListener("keydown", handler)
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      switch (e.key.toLowerCase()) {
        case "p":
          e.preventDefault()
          router.push("/patients/new")
          break
        case "a":
          e.preventDefault()
          router.push("/appointments/new")
          break
        case "i":
          e.preventDefault()
          router.push("/billing/invoices/new")
          break
      }
    }
    window.addEventListener("keydown", handler)
    // Auto-cleanup after 1.5s if no follow-up key
    setTimeout(() => window.removeEventListener("keydown", handler), 1500)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {SHORTCUTS.map((section) => (
            <div key={section.section}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">{section.section}</h4>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.description} className="flex items-center justify-between text-sm">
                    <span>{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-muted-foreground mx-0.5">then</span>}
                          <kbd className="px-2 py-0.5 bg-muted rounded border text-xs font-mono">{key}</kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
