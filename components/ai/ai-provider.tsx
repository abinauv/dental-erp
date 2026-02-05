"use client"

import React, { createContext, useContext, useState, useCallback, useRef } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

export interface Suggestion {
  title: string
  description: string
  action: string
  urgency: "normal" | "warning" | "critical"
}

export interface Insight {
  id: string
  category: string
  severity: string
  title: string
  description: string
  dismissed: boolean
  actionTaken: boolean
  createdAt: string
}

export interface CommandResult {
  intent: string
  summary?: string
  requiresApproval: boolean
  result: any
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface AIContextType {
  // Chat
  chatMessages: ChatMsg[]
  chatLoading: boolean
  sendChat: (message: string, opts?: { patientId?: string; page?: string; skillName?: string }) => Promise<void>
  clearChat: () => void

  // Commands
  commandLoading: boolean
  executeCommand: (command: string, opts?: { patientId?: string; page?: string }) => Promise<CommandResult | null>

  // Insights
  insights: Insight[]
  insightsLoading: boolean
  loadInsights: () => Promise<void>
  dismissInsight: (id: string) => Promise<void>
  generateInsights: () => Promise<void>

  // Suggestions
  suggestions: Suggestion[]
  loadSuggestions: (page: string, patientId?: string) => Promise<void>
}

const AIContext = createContext<AIContextType | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AIProvider({ children }: { children: React.ReactNode }) {
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [commandLoading, setCommandLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const sendChat = useCallback(async (message: string, opts?: { patientId?: string; page?: string; skillName?: string }) => {
    setChatLoading(true)
    // Abort any previous stream
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: ChatMsg = { role: "user", content: message }
    setChatMessages((prev) => [...prev, userMsg])

    // Optimistic assistant placeholder
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }])

    try {
      const body: any = {
        messages: [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        ...(opts?.patientId && { patientId: opts.patientId }),
        ...(opts?.page && { page: opts.page }),
        ...(opts?.skillName && { skillName: opts.skillName }),
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Unknown error")
        setChatMessages((prev) => prev.slice(0, -1).concat({ role: "assistant", content: `Error: ${errText}` }))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.done) break
              if (data.text) {
                accumulated += data.text
                // Update the last (assistant) message in place
                setChatMessages((prev) => {
                  const next = [...prev]
                  next[next.length - 1] = { role: "assistant", content: accumulated }
                  return next
                })
              }
            } catch {
              // ignore malformed
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setChatMessages((prev) => prev.slice(0, -1).concat({ role: "assistant", content: "Connection error. Please try again." }))
    } finally {
      setChatLoading(false)
    }
  }, [chatMessages])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setChatMessages([])
  }, [])

  const executeCommand = useCallback(async (command: string, opts?: { patientId?: string; page?: string }): Promise<CommandResult | null> => {
    setCommandLoading(true)
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, ...opts }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    } finally {
      setCommandLoading(false)
    }
  }, [])

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true)
    try {
      const res = await fetch("/api/ai/insights")
      if (res.ok) {
        const data = await res.json()
        setInsights(data.insights || [])
      }
    } catch {
      // silent
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  const dismissInsight = useCallback(async (id: string) => {
    try {
      await fetch("/api/ai/insights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dismissed: true }),
      })
      setInsights((prev) => prev.filter((i) => i.id !== id))
    } catch {
      // silent
    }
  }, [])

  const generateInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/insights", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setInsights((prev) => [...(data.insights || []), ...prev])
      }
    } catch {
      // silent
    }
  }, [])

  const loadSuggestions = useCallback(async (page: string, patientId?: string) => {
    try {
      const params = new URLSearchParams({ page })
      if (patientId) params.set("patientId", patientId)
      const res = await fetch(`/api/ai/suggestions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch {
      // silent
    }
  }, [])

  return (
    <AIContext.Provider
      value={{
        chatMessages,
        chatLoading,
        sendChat,
        clearChat,
        commandLoading,
        executeCommand,
        insights,
        insightsLoading,
        loadInsights,
        dismissInsight,
        generateInsights,
        suggestions,
        loadSuggestions,
      }}
    >
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error("useAI must be used inside <AIProvider>")
  return ctx
}
