"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useAI } from "@/components/ai/ai-provider"
import { useWebVoice } from "@/hooks/use-web-voice"
import { VoiceOrb } from "@/components/ai/voice-orb"
import { AudioWaveform } from "@/components/ai/audio-waveform"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-2 h-2 rounded-full bg-muted-foreground/40"
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

// Icons
function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function HandsFreeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ChatPage() {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { chatMessages, chatLoading, sendChat, clearChat } = useAI()
  const isVoiceRequest = useRef(false)
  const prevMsgCountRef = useRef(0)

  const voice = useWebVoice({
    lang: "en-IN",
    onFinalTranscript: (text) => {
      if (text.trim() && !chatLoading) {
        isVoiceRequest.current = true
        setInput("")
        sendChat(text.trim(), { page: "/chat" })
      }
    },
  })

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    isVoiceRequest.current = false
    setInput("")
    sendChat(msg, { page: "/chat" })
  }

  const handleSuggestion = (prompt: string) => {
    if (prompt.endsWith(" ")) {
      setInput(prompt)
      inputRef.current?.focus()
    } else {
      isVoiceRequest.current = false
      sendChat(prompt, { page: "/chat" })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
  }

  const handleOrbPress = useCallback(() => {
    if (chatLoading && voice.state !== "speaking") return
    switch (voice.state) {
      case "idle":
        voice.startListening()
        break
      case "listening":
        voice.stopListening()
        break
      case "speaking":
        voice.interruptSpeaking()
        break
    }
  }, [voice.state, chatLoading])

  const isLastAssistantEmpty =
    chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1].role === "assistant" &&
    chatMessages[chatMessages.length - 1].content === ""

  // Effective orb state: show processing when AI is thinking after voice request
  const orbState =
    chatLoading && isVoiceRequest.current ? "processing" : voice.state

  const hasMessages = chatMessages.length > 0

  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100%+2rem)] md:h-[calc(100%+3rem)]">
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

      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <div>
          <h1 className="text-lg font-semibold">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">
            {voice.handsFreeMode
              ? "Hands-free mode — speak naturally, I'll respond and keep listening"
              : "Type or speak to manage your clinic"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hands-free toggle */}
          {voice.voiceSupported && (
            <button
              onClick={voice.toggleHandsFree}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
                voice.handsFreeMode
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted border-border"
              )}
              title="Hands-free: continuous voice conversation"
            >
              <HandsFreeIcon />
              <span className="hidden sm:inline">Hands-free</span>
            </button>
          )}
          {/* TTS toggle */}
          <button
            onClick={voice.toggleTts}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
              voice.ttsEnabled
                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                : "text-muted-foreground hover:bg-muted border-border"
            )}
            title={voice.ttsEnabled ? "Voice responses ON" : "Voice responses OFF"}
          >
            <SpeakerIcon active={voice.ttsEnabled} />
            <span className="hidden sm:inline">{voice.ttsEnabled ? "Voice on" : "Voice off"}</span>
          </button>
          {/* New chat */}
          {hasMessages && (
            <button
              onClick={() => { clearChat(); prevMsgCountRef.current = 0 }}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              New Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        {!hasMessages ? (
          /* Empty state with voice orb */
          <div className="flex flex-col items-center justify-center h-full px-4">
            {/* Voice orb */}
            {voice.voiceSupported && (
              <div className="mb-4">
                <VoiceOrb
                  state={orbState}
                  audioLevel={voice.audioLevel}
                  size={160}
                  onPress={handleOrbPress}
                  disabled={chatLoading && !isVoiceRequest.current}
                />
              </div>
            )}

            {/* Waveform */}
            {(orbState === "listening" || orbState === "speaking") && (
              <div className="mb-4 h-10">
                <AudioWaveform
                  audioLevel={voice.audioLevel}
                  state={orbState}
                  barCount={28}
                  width={260}
                  height={36}
                />
              </div>
            )}

            {/* Status text */}
            {orbState === "listening" && (
              <div className="flex items-center gap-2 text-sm text-red-500 font-medium mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                {voice.interimTranscript || voice.transcript || "Listening..."}
              </div>
            )}
            {orbState === "processing" && (
              <p className="text-sm text-purple-500 font-medium mb-4">Thinking...</p>
            )}
            {orbState === "speaking" && (
              <p className="text-sm text-blue-500 font-medium mb-4">Speaking... (click orb to stop)</p>
            )}

            {/* Welcome text */}
            {orbState === "idle" && (
              <>
                {!voice.voiceSupported && (
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
                )}
                <h2 className="text-xl font-semibold mb-2">How can I help you today?</h2>
                <p className="text-sm text-muted-foreground mb-2 text-center max-w-md">
                  I can look up patients, check appointments, show revenue, manage inventory, and more.
                </p>
                {voice.voiceSupported && (
                  <p className="text-xs text-primary mb-6 text-center">
                    Tap the orb to speak, or type below. Enable Hands-free for continuous conversation.
                  </p>
                )}
                {!voice.voiceSupported && (
                  <p className="text-xs text-muted-foreground mb-6">Just ask in plain English.</p>
                )}
              </>
            )}

            {/* Suggestion chips */}
            {orbState === "idle" && (
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
            )}
          </div>
        ) : (
          /* Message list */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {chatMessages.map((msg, i) => {
              const isStreaming = chatLoading && msg.role === "assistant" && i === chatMessages.length - 1
              const isEmpty = msg.content === ""
              if (isStreaming && isEmpty) return null

              return (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
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
                      {msg.content}
                      {isStreaming && !isEmpty && <BlinkingCursor />}
                    </div>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-foreground">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Typing indicator */}
            {chatLoading && isLastAssistantEmpty && (
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
                  <TypingDots />
                </div>
              </div>
            )}

            {/* In-conversation voice section */}
            {voice.voiceSupported && (
              <div className="flex flex-col items-center py-4">
                <VoiceOrb
                  state={orbState}
                  audioLevel={voice.audioLevel}
                  size={80}
                  onPress={handleOrbPress}
                  disabled={chatLoading && !isVoiceRequest.current}
                />
                {(orbState === "listening" || orbState === "speaking") && (
                  <div className="mt-3">
                    <AudioWaveform
                      audioLevel={voice.audioLevel}
                      state={orbState}
                      barCount={20}
                      width={180}
                      height={28}
                    />
                  </div>
                )}
                {orbState === "listening" && (
                  <p className="text-xs text-red-500 font-medium mt-2">
                    {voice.interimTranscript || voice.transcript || "Listening..."}
                  </p>
                )}
                {orbState === "processing" && (
                  <p className="text-xs text-purple-500 font-medium mt-2">Thinking...</p>
                )}
                {orbState === "speaking" && (
                  <p className="text-xs text-blue-500 font-medium mt-2">Speaking...</p>
                )}
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
            placeholder={voice.state === "listening" ? "Listening..." : "Type a message..."}
            rows={1}
            className="flex-1 resize-none rounded-xl border bg-muted px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
          />
          {/* Mic button */}
          {voice.voiceSupported && (
            <button
              onClick={() => {
                if (voice.state === "listening") {
                  voice.stopListening()
                } else if (voice.state === "speaking") {
                  voice.interruptSpeaking()
                } else {
                  voice.startListening()
                }
              }}
              disabled={chatLoading && voice.state === "idle"}
              className={cn(
                "rounded-xl px-3 py-3 transition-all shrink-0",
                voice.state === "listening"
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-200 dark:shadow-red-900/30"
                  : voice.state === "speaking"
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-muted border hover:bg-accent text-muted-foreground disabled:opacity-40"
              )}
              aria-label={
                voice.state === "listening" ? "Stop listening" :
                voice.state === "speaking" ? "Stop speaking" :
                "Start voice input"
              }
              title={
                voice.state === "listening" ? "Stop listening" :
                voice.state === "speaking" ? "Stop speaking" :
                "Speak your message"
              }
            >
              <span className="relative flex items-center justify-center">
                {voice.state === "listening" && (
                  <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
                )}
                <MicIcon size={20} />
              </span>
            </button>
          )}
          {/* Send button */}
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
