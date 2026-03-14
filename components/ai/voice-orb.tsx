"use client"

import type { VoiceState } from "@/hooks/use-web-voice"
import { cn } from "@/lib/utils"

interface VoiceOrbProps {
  state: VoiceState
  audioLevel: number
  size?: number
  onPress: () => void
  disabled?: boolean
}

/**
 * Animated voice orb for browser — CSS-based equivalent of the mobile VoiceOrb.
 * Shows state through color, scale, ripple rings, and glow effects.
 */
export function VoiceOrb({ state, audioLevel, size = 120, onPress, disabled }: VoiceOrbProps) {
  const isActive = state !== "idle"
  // Dynamic scale based on audio level when listening
  const dynamicScale = state === "listening" ? 1 + audioLevel * 0.15 : 1

  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="relative flex items-center justify-center focus:outline-none group"
      style={{ width: size, height: size }}
      aria-label={
        state === "idle" ? "Start voice input" :
        state === "listening" ? "Stop listening" :
        state === "speaking" ? "Interrupt" :
        "Processing..."
      }
    >
      {/* Ripple rings — visible when listening or speaking */}
      {(state === "listening" || state === "speaking") && (
        <>
          <span
            className={cn(
              "absolute inset-0 rounded-full border-2 opacity-0",
              state === "listening" ? "border-red-400" : "border-blue-400"
            )}
            style={{
              animation: "orb-ripple 2s ease-out infinite",
            }}
          />
          <span
            className={cn(
              "absolute inset-0 rounded-full border-2 opacity-0",
              state === "listening" ? "border-red-400" : "border-blue-400"
            )}
            style={{
              animation: "orb-ripple 2s ease-out infinite 0.6s",
            }}
          />
          <span
            className={cn(
              "absolute inset-0 rounded-full border-2 opacity-0",
              state === "listening" ? "border-red-400" : "border-blue-400"
            )}
            style={{
              animation: "orb-ripple 2s ease-out infinite 1.2s",
            }}
          />
        </>
      )}

      {/* Processing spinner ring */}
      {state === "processing" && (
        <span
          className="absolute inset-1 rounded-full border-2 border-transparent border-t-purple-400 border-r-purple-400"
          style={{ animation: "orb-spin 1s linear infinite" }}
        />
      )}

      {/* Glow */}
      <span
        className={cn(
          "absolute rounded-full transition-all duration-300",
          state === "idle" && "opacity-0",
          state === "listening" && "opacity-40 bg-red-500",
          state === "speaking" && "opacity-30 bg-blue-500",
          state === "processing" && "opacity-25 bg-purple-500"
        )}
        style={{
          inset: -size * 0.1,
          filter: `blur(${size * 0.15}px)`,
        }}
      />

      {/* Main orb */}
      <span
        className={cn(
          "relative rounded-full flex items-center justify-center transition-all duration-200 shadow-lg",
          state === "idle" && "bg-gradient-to-br from-primary to-primary/80 group-hover:shadow-xl group-hover:scale-105",
          state === "listening" && "bg-gradient-to-br from-red-500 to-red-600",
          state === "speaking" && "bg-gradient-to-br from-blue-500 to-blue-600",
          state === "processing" && "bg-gradient-to-br from-purple-500 to-purple-600",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{
          width: size * 0.7,
          height: size * 0.7,
          transform: `scale(${dynamicScale})`,
        }}
      >
        {/* Icon */}
        {state === "idle" && (
          <svg width={size * 0.22} height={size * 0.22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
        {state === "listening" && (
          <span className="flex items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="bg-white rounded-full"
                style={{
                  width: Math.max(2, size * 0.025),
                  height: Math.max(8, size * 0.06 + audioLevel * size * 0.12 * (i === 2 ? 1.5 : i === 1 || i === 3 ? 1.2 : 0.8)),
                  transition: "height 0.1s ease",
                }}
              />
            ))}
          </span>
        )}
        {state === "processing" && (
          <svg width={size * 0.2} height={size * 0.2} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: "orb-spin 2s linear infinite" }}>
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
          </svg>
        )}
        {state === "speaking" && (
          <svg width={size * 0.22} height={size * 0.22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </span>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes orb-ripple {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes orb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
