"use client"

import { useState, useRef, useEffect } from "react"
import { useAI } from "@/components/ai/ai-provider"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  { label: "Daily summary", prompt: "Give me today's daily summary" },
  { label: "Register patient", prompt: "Create a new patient named " },
  { label: "Book appointment", prompt: "Book an appointment for " },
  { label: "Create invoice", prompt: "Create an invoice for " },
  { label: "Record payment", prompt: "Record a payment for " },
  { label: "Today's appointments", prompt: "Show today's appointments" },
  { label: "Overdue invoices", prompt: "Check overdue invoices" },
  { label: "Revenue this month", prompt: "Show revenue this month" },
  { label: "Low stock items", prompt: "Show low stock items" },
  { label: "Patient lookup", prompt: "Look up patient " },
  { label: "Create lab order", prompt: "Create a lab order for " },
  { label: "Show staff", prompt: "Show all staff members" },
]

export default function ChatPage() {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { chatMessages, chatLoading, sendChat, clearChat } = useAI()

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput("")
    sendChat(msg, { page: "/chat" })
  }

  const handleSuggestion = (prompt: string) => {
    if (prompt.endsWith(" ")) {
      // Partial prompt — place in input for user to complete
      setInput(prompt)
      inputRef.current?.focus()
    } else {
      sendChat(prompt, { page: "/chat" })
    }
  }

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
  }

  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100%+2rem)] md:h-[calc(100%+3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <div>
          <h1 className="text-lg font-semibold">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">
            Ask questions about your data or perform quick tasks
          </p>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            New Chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        {chatMessages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">How can I help you today?</h2>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
              I can look up patients, check appointments, show revenue, manage inventory, and more.
              Just ask in plain English.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestion(s.prompt)}
                  className="rounded-lg border p-3 text-left hover:bg-muted transition-colors group"
                >
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {s.prompt.endsWith(" ") ? `"${s.prompt.trim()}..."` : `"${s.prompt}"`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {/* Bot avatar */}
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                      <path d="M12 8V4H8" />
                      <rect width="16" height="12" x="4" y="8" rx="2" />
                      <path d="M2 14h2" />
                      <path d="M20 14h2" />
                      <path d="M15 13v2" />
                      <path d="M9 13v2" />
                    </svg>
                  </div>
                )}

                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[75%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content || (chatLoading && i === chatMessages.length - 1 ? "" : "")}
                  </div>
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-foreground">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming indicator */}
            {chatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].content === "" && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M12 8V4H8" />
                    <rect width="16" height="12" x="4" y="8" rx="2" />
                    <path d="M2 14h2" />
                    <path d="M20 14h2" />
                    <path d="M15 13v2" />
                    <path d="M9 13v2" />
                  </svg>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border bg-muted px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className="rounded-xl bg-primary px-4 py-3 text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}
