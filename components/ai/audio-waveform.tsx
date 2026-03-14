"use client"

import type { VoiceState } from "@/hooks/use-web-voice"

interface AudioWaveformProps {
  audioLevel: number
  state: VoiceState
  barCount?: number
  width?: number
  height?: number
}

/**
 * CSS-animated audio waveform for browser — mirrors the mobile AudioWaveform.
 * Bars react to audio level with center-weighted heights.
 */
export function AudioWaveform({
  audioLevel,
  state,
  barCount = 24,
  width = 220,
  height = 36,
}: AudioWaveformProps) {
  if (state !== "listening" && state !== "speaking") return null

  const barWidth = Math.max(2, (width / barCount) * 0.55)
  const barGap = (width - barCount * barWidth) / (barCount - 1)
  const center = (barCount - 1) / 2

  const color = state === "listening" ? "#ef4444" : "#3b82f6"

  return (
    <div
      className="flex items-center justify-center"
      style={{ width, height }}
      role="img"
      aria-label={state === "listening" ? "Audio input level" : "Audio output level"}
    >
      {Array.from({ length: barCount }, (_, i) => {
        // Center-weighted: bars near center are taller
        const distFromCenter = Math.abs(i - center) / center
        const weight = 1 - distFromCenter * 0.6
        // Combine real audio level with a gentle idle bounce per bar
        const idleFactor = 0.15 + 0.1 * Math.sin(Date.now() / 300 + i * 0.5)
        const level = Math.max(idleFactor, audioLevel * weight)
        const barHeight = Math.max(3, level * height * 0.9)

        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              opacity: 0.5 + level * 0.5,
              marginLeft: i === 0 ? 0 : barGap,
              transition: "height 0.08s ease, opacity 0.08s ease",
            }}
          />
        )
      })}
    </div>
  )
}
