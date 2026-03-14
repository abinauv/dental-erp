"use client"

import { useState, useRef, useCallback, useEffect } from "react"

// ---------------------------------------------------------------------------
// Web Speech API types (not in all TS libs)
// ---------------------------------------------------------------------------
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onspeechend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

// ---------------------------------------------------------------------------
// Voice state
// ---------------------------------------------------------------------------
export type VoiceState = "idle" | "listening" | "processing" | "speaking"

interface UseWebVoiceOptions {
  lang?: string
  onFinalTranscript?: (text: string) => void
  /** Called when TTS finishes speaking in hands-free mode */
  onSpeakEnd?: () => void
}

export function useWebVoice(opts: UseWebVoiceOptions = {}) {
  const { lang = "en-IN", onFinalTranscript, onSpeakEnd } = opts

  const [state, setState] = useState<VoiceState>("idle")
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [handsFreeMode, setHandsFreeMode] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const onSpeakEndRef = useRef(onSpeakEnd)
  const handsFreeRef = useRef(handsFreeMode)
  const ttsEnabledRef = useRef(ttsEnabled)

  // Keep refs in sync
  useEffect(() => { onFinalTranscriptRef.current = onFinalTranscript }, [onFinalTranscript])
  useEffect(() => { onSpeakEndRef.current = onSpeakEnd }, [onSpeakEnd])
  useEffect(() => { handsFreeRef.current = handsFreeMode }, [handsFreeMode])
  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])

  // Check support on mount
  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition())
  }, [])

  // -------------------------------------------------------------------------
  // Audio level monitoring (microphone volume for waveform visualization)
  // -------------------------------------------------------------------------
  const startAudioMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(dataArray)
        // Average frequency amplitude, normalize to 0-1
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const avg = sum / dataArray.length / 255
        setAudioLevel(avg)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // Permission denied or no mic — continue without visualization
    }
  }, [])

  const stopAudioMonitor = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = null
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
  }, [])

  // -------------------------------------------------------------------------
  // Speech-to-text
  // -------------------------------------------------------------------------
  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }
      if (final) {
        setTranscript(final)
        setInterimTranscript("")
      } else {
        setInterimTranscript(interim)
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Speech recognition error:", e.error)
      }
      setState("idle")
      stopAudioMonitor()
    }

    recognition.onend = () => {
      setState("idle")
      stopAudioMonitor()
    }

    // When user stops speaking, auto-fire the final transcript
    recognition.onspeechend = () => {
      setTimeout(() => {
        recognition.stop()
      }, 600)
    }

    recognitionRef.current = recognition
    setTranscript("")
    setInterimTranscript("")
    setState("listening")
    recognition.start()
    startAudioMonitor()
  }, [lang, startAudioMonitor, stopAudioMonitor])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    setState("idle")
    stopAudioMonitor()
  }, [stopAudioMonitor])

  // Fire onFinalTranscript when listening ends with a transcript
  const prevStateRef = useRef<VoiceState>("idle")
  useEffect(() => {
    if (prevStateRef.current === "listening" && state === "idle" && transcript.trim()) {
      onFinalTranscriptRef.current?.(transcript.trim())
    }
    prevStateRef.current = state
  }, [state, transcript])

  // -------------------------------------------------------------------------
  // Text-to-speech
  // -------------------------------------------------------------------------
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/[*_#`~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ", ")

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 1.05
    utterance.pitch = 1

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) ||
      voices.find((v) => v.lang.startsWith("en"))
    if (preferred) utterance.voice = preferred

    setState("speaking")

    utterance.onend = () => {
      setState("idle")
      onSpeakEndRef.current?.()
      // In hands-free mode, auto-resume listening after speaking
      if (handsFreeRef.current) {
        setTimeout(() => {
          const SR = getSpeechRecognition()
          if (SR) startListening()
        }, 400)
      }
    }

    utterance.onerror = () => {
      setState("idle")
    }

    window.speechSynthesis.speak(utterance)
  }, [startListening])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
    }
    setState("idle")
  }, [])

  // -------------------------------------------------------------------------
  // Hands-free toggle
  // -------------------------------------------------------------------------
  const toggleHandsFree = useCallback(() => {
    setHandsFreeMode((prev) => {
      const next = !prev
      if (next) {
        setTtsEnabled(true)
        // Start listening immediately
        setTimeout(() => startListening(), 100)
      } else {
        stopListening()
        stopSpeaking()
      }
      return next
    })
  }, [startListening, stopListening, stopSpeaking])

  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      if (prev && typeof window !== "undefined") {
        window.speechSynthesis?.cancel()
        setState((s) => s === "speaking" ? "idle" : s)
      }
      return !prev
    })
  }, [])

  // Interrupt speaking (stop TTS, go back to idle)
  const interruptSpeaking = useCallback(() => {
    stopSpeaking()
  }, [stopSpeaking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }
      if (typeof window !== "undefined") window.speechSynthesis?.cancel()
      stopAudioMonitor()
    }
  }, [stopAudioMonitor])

  return {
    state,
    setState,
    transcript,
    interimTranscript,
    audioLevel,
    voiceSupported,
    ttsEnabled,
    handsFreeMode,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    interruptSpeaking,
    toggleHandsFree,
    toggleTts,
  }
}
