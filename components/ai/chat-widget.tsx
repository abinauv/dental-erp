"use client"

import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAI } from "./ai-provider"
import { useWebVoice } from "@/hooks/use-web-voice"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function MicIcon({ listening }: { listening: boolean }) {
  return (
    <span className="relative flex items-center justify-center">
      {listening && (
        <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
      )}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={listening ? "text-red-500" : ""}
      >
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </span>
  )
}

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-primary" : "opacity-50"}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {active ? (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      ) : (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      )}
    </svg>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-[6px] h-[6px] rounded-full bg-current opacity-40"
          style={{
            animation: "chat-bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  )
}

function BlinkingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[1em] bg-current align-text-bottom ml-[1px]"
      style={{ animation: "chat-blink 0.8s step-end infinite" }}
    />
  )
}

// ---------------------------------------------------------------------------
// ChatWidget
// ---------------------------------------------------------------------------
export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevMsgCountRef = useRef(0)
  const pathname = usePathname()
  const { chatMessages, chatLoading, sendChat, clearChat } = useAI()

  const voice = useWebVoice({
    lang: "en-IN",
    onFinalTranscript: (text) => {
      if (text.trim() && !chatLoading) {
        setInput("")
        sendChat(text.trim(), { page: pathname })
      }
    },
  })

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // TTS — speak assistant response once streaming finishes
  useEffect(() => {
    if (!voice.ttsEnabled || chatLoading) return
    if (typeof window === "undefined" || !window.speechSynthesis) return

    const msgs = chatMessages
    if (msgs.length === 0) return
    if (msgs.length <= prevMsgCountRef.current) {
      prevMsgCountRef.current = msgs.length
      return
    }
    prevMsgCountRef.current = msgs.length
    const last = msgs[msgs.length - 1]
    if (last.role !== "assistant" || !last.content) return

    voice.speakText(last.content)
  }, [chatMessages, chatLoading, voice.ttsEnabled])

  // Show interim transcript in input while listening
  useEffect(() => {
    if (voice.state === "listening") {
      const display = voice.transcript || voice.interimTranscript
      if (display) setInput(display)
    }
  }, [voice.state, voice.transcript, voice.interimTranscript])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput("")
    sendChat(msg, { page: pathname })
  }

  const isLastAssistantEmpty =
    chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1].role === "assistant" &&
    chatMessages[chatMessages.length - 1].content === ""

  const listening = voice.state === "listening"

  // Hide widget on the dedicated /chat page to avoid overlapping the full chat UI
  if (pathname === "/chat") return null

  return (
    <>
      <style jsx global>{`
        @keyframes chat-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes chat-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

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
        <div className="fixed bottom-0 right-0 z-40 w-full max-w-sm h-[min(520px,85dvh)] flex flex-col border border-t-0 rounded-tl-lg bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 bg-primary text-primary-foreground rounded-tl-lg">
            <div>
              <p className="font-semibold text-sm">AI Assistant</p>
              <p className="text-xs opacity-70">
                {voice.handsFreeMode ? "Hands-free mode active" : "Ask anything about your clinic"}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {/* Hands-free toggle */}
              {voice.voiceSupported && (
                <button
                  onClick={voice.toggleHandsFree}
                  className={cn(
                    "rounded-md px-1.5 py-1 text-[10px] font-medium transition-all",
                    voice.handsFreeMode
                      ? "bg-primary-foreground text-primary"
                      : "opacity-60 hover:opacity-100 border border-primary-foreground/30"
                  )}
                  aria-label="Toggle hands-free mode"
                  title="Hands-free: voice in + voice out, continuous"
                >
                  HF
                </button>
              )}
              {/* TTS toggle */}
              <button
                onClick={voice.toggleTts}
                className="p-2 -m-1 opacity-60 hover:opacity-100 transition-opacity"
                aria-label={voice.ttsEnabled ? "Mute responses" : "Read responses aloud"}
                title={voice.ttsEnabled ? "Voice responses ON" : "Voice responses OFF"}
              >
                <SpeakerIcon active={voice.ttsEnabled} />
              </button>
              <button onClick={clearChat} className="p-2 -m-1 opacity-60 hover:opacity-100 transition-opacity" aria-label="Clear chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button onClick={() => setOpen(false)} className="p-2 -m-1 opacity-60 hover:opacity-100 transition-opacity" aria-label="Close">
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
                {voice.voiceSupported && (
                  <p className="text-xs text-primary mt-1">
                    Tap the mic or enable Hands-Free mode for voice control
                  </p>
                )}
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["Daily summary", "Register patient", "Book appointment", "Today's schedule"].map((hint) => (
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

            {chatMessages.map((msg, i) => {
              const isStreaming = chatLoading && msg.role === "assistant" && i === chatMessages.length - 1
              const isEmpty = msg.content === ""
              if (isStreaming && isEmpty) return null

              return (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {msg.content}
                    {isStreaming && !isEmpty && <BlinkingCursor />}
                  </div>
                </div>
              )
            })}

            {/* Typing indicator */}
            {chatLoading && isLastAssistantEmpty && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2.5">
                  <TypingDots />
                </div>
              </div>
            )}

            {/* Listening indicator */}
            {listening && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 text-xs text-red-500 font-medium bg-red-50 dark:bg-red-950/30 rounded-full px-3 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  {voice.interimTranscript || voice.transcript || "Listening..."}
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
              placeholder={listening ? "Listening..." : "Type or tap mic..."}
              rows={1}
              className="flex-1 resize-none rounded-md border bg-muted px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
            />
            {/* Mic button */}
            {voice.voiceSupported && (
              <button
                onClick={() => {
                  if (voice.state === "listening") voice.stopListening()
                  else if (voice.state === "speaking") voice.interruptSpeaking()
                  else voice.startListening()
                }}
                disabled={chatLoading && voice.state === "idle"}
                className={cn(
                  "rounded-md px-2.5 py-2 text-sm transition-all disabled:opacity-40",
                  listening
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-muted border hover:bg-accent"
                )}
                aria-label={listening ? "Stop listening" : "Start voice input"}
                title={listening ? "Stop listening" : "Speak your message"}
              >
                <MicIcon listening={listening} />
              </button>
            )}
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
