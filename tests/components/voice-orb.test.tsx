// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { VoiceOrb } from '@/components/ai/voice-orb'

describe('VoiceOrb', () => {
  const mockOnPress = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a button', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has aria-label "Start voice input" when idle', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} />)
    expect(screen.getByLabelText('Start voice input')).toBeInTheDocument()
  })

  it('has aria-label "Stop listening" when listening', () => {
    render(<VoiceOrb state="listening" audioLevel={0.5} onPress={mockOnPress} />)
    expect(screen.getByLabelText('Stop listening')).toBeInTheDocument()
  })

  it('has aria-label "Interrupt" when speaking', () => {
    render(<VoiceOrb state="speaking" audioLevel={0} onPress={mockOnPress} />)
    expect(screen.getByLabelText('Interrupt')).toBeInTheDocument()
  })

  it('has aria-label "Processing..." when processing', () => {
    render(<VoiceOrb state="processing" audioLevel={0} onPress={mockOnPress} />)
    expect(screen.getByLabelText('Processing...')).toBeInTheDocument()
  })

  it('calls onPress when clicked', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onPress when disabled', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockOnPress).not.toHaveBeenCalled()
  })

  it('uses default size of 120', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} />)
    const button = screen.getByRole('button')
    expect(button.style.width).toBe('120px')
    expect(button.style.height).toBe('120px')
  })

  it('uses custom size', () => {
    render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} size={80} />)
    const button = screen.getByRole('button')
    expect(button.style.width).toBe('80px')
    expect(button.style.height).toBe('80px')
  })

  it('renders microphone SVG icon when idle', () => {
    const { container } = render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} />)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(1)
    // Microphone icon has a rect element
    const rect = container.querySelector('rect')
    expect(rect).toBeInTheDocument()
  })

  it('renders waveform bars when listening', () => {
    const { container } = render(<VoiceOrb state="listening" audioLevel={0.5} onPress={mockOnPress} />)
    // 5 waveform bars rendered as spans with rounded-full class
    const bars = container.querySelectorAll('span.bg-white.rounded-full')
    expect(bars.length).toBe(5)
  })

  it('renders ripple rings when listening', () => {
    const { container } = render(<VoiceOrb state="listening" audioLevel={0.5} onPress={mockOnPress} />)
    // 3 ripple rings with animation
    const ripples = container.querySelectorAll('span[style*="orb-ripple"]')
    expect(ripples.length).toBe(3)
  })

  it('renders ripple rings when speaking', () => {
    const { container } = render(<VoiceOrb state="speaking" audioLevel={0} onPress={mockOnPress} />)
    const ripples = container.querySelectorAll('span[style*="orb-ripple"]')
    expect(ripples.length).toBe(3)
  })

  it('renders processing spinner when processing', () => {
    const { container } = render(<VoiceOrb state="processing" audioLevel={0} onPress={mockOnPress} />)
    const spinner = container.querySelector('span[style*="orb-spin"]')
    expect(spinner).toBeInTheDocument()
  })

  it('does not render ripple rings when idle', () => {
    const { container } = render(<VoiceOrb state="idle" audioLevel={0} onPress={mockOnPress} />)
    const ripples = container.querySelectorAll('span[style*="orb-ripple"]')
    expect(ripples.length).toBe(0)
  })

  it('renders speaker icon when speaking', () => {
    const { container } = render(<VoiceOrb state="speaking" audioLevel={0} onPress={mockOnPress} />)
    // Speaker icon has a polygon element
    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
  })

  it('scales dynamically based on audioLevel when listening', () => {
    const { container } = render(<VoiceOrb state="listening" audioLevel={0.8} onPress={mockOnPress} />)
    // Main orb should have transform with scale > 1
    const orbSpan = container.querySelector('span[style*="scale"]')
    expect(orbSpan).toBeInTheDocument()
    // scale should be 1 + 0.8 * 0.15 = 1.12
    expect(orbSpan?.style.transform).toContain('scale(1.12)')
  })
})
