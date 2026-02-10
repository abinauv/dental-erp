"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Loader2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface VoiceInputProps {
  onTranscript: (text: string) => void
  language?: string
  className?: string
}

export function VoiceInput({ onTranscript, language = "en-IN", className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [interimText, setInterimText] = useState("")
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setInterimText("")
    }

    recognition.onresult = (event: any) => {
      let interim = ""
      let final = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (final) {
        onTranscript(final)
        setInterimText("")
      } else {
        setInterimText(interim)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error)
      }
      setIsListening(false)
      setInterimText("")
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText("")
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [language, onTranscript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    setInterimText("")
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  if (!isSupported) return null

  return (
    <TooltipProvider>
      <div className={`inline-flex items-center gap-2 ${className || ""}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className={`h-8 w-8 ${isListening ? "animate-pulse" : ""}`}
              onClick={toggleListening}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isListening ? "Stop dictation" : "Start voice dictation"}
          </TooltipContent>
        </Tooltip>

        {isListening && interimText && (
          <span className="text-xs text-muted-foreground italic max-w-[200px] truncate">
            {interimText}...
          </span>
        )}

        {isListening && !interimText && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Listening...
          </span>
        )}
      </div>
    </TooltipProvider>
  )
}
