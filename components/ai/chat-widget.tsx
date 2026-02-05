"use client"

import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAI } from "./ai-provider"
import { cn } from "@/lib/utils"

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()
  const { chatMessages, chatLoading, sendChat, clearChat } = useAI()

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput("")
    sendChat(msg, { page: pathname })
  }

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Open AI chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-40 w-full max-w-sm h-[520px] flex flex-col border border-t-0 rounded-tl-lg bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 bg-primary text-primary-foreground rounded-tl-lg">
            <div>
              <p className="font-semibold text-sm">AI Assistant</p>
              <p className="text-xs opacity-70">Ask anything about your clinic</p>
            </div>
            <div className="flex gap-2">
              <button onClick={clearChat} className="opacity-60 hover:opacity-100 transition-opacity" aria-label="Clear chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100 transition-opacity" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8 px-4">
                <p className="font-medium mb-1">How can I help?</p>
                <p className="text-xs">Ask about patients, appointments, billing, inventory, or anything else.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["Patient summary", "Today's schedule", "Revenue this month"].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => { setInput(hint); inputRef.current?.focus() }}
                      className="rounded-full border px-3 py-1 text-xs hover:bg-muted transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content || (chatLoading && i === chatMessages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {chatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].content === "" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <span className="animate-pulse text-muted-foreground">●●●</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 resize-none rounded-md border bg-muted px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={chatLoading || !input.trim()}
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
