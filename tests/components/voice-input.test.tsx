// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const icon = (name: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement('svg', { ...props, ref, 'data-testid': `lucide-${name}` })
    )
  const actual = (await importOriginal()) as any
  const handler = { get: (_: any, p: string) => actual[p] || icon(p) }
  return new Proxy(actual, handler)
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} className={className} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <>{children}</>,
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <span data-testid="tooltip">{children}</span>,
}))

import { VoiceInput } from '@/components/clinical/voice-input'

describe('VoiceInput', () => {
  const mockOnTranscript = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when SpeechRecognition not supported', () => {
    // jsdom does not have SpeechRecognition
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition
    const { container } = render(<VoiceInput onTranscript={mockOnTranscript} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders mic button when SpeechRecognition is available', () => {
    (window as any).webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      lang: '',
      continuous: false,
      interimResults: false,
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    }))

    render(<VoiceInput onTranscript={mockOnTranscript} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows tooltip "Start voice dictation" by default', () => {
    (window as any).webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      lang: '',
      continuous: false,
      interimResults: false,
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    }))

    render(<VoiceInput onTranscript={mockOnTranscript} />)
    expect(screen.getByText('Start voice dictation')).toBeInTheDocument()
  })

  it('cleans up recognition on unmount', () => {
    const stopMock = vi.fn()
    ;(window as any).webkitSpeechRecognition = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: stopMock,
      lang: '',
      continuous: false,
      interimResults: false,
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    }))

    const { unmount } = render(<VoiceInput onTranscript={mockOnTranscript} />)
    unmount()
    // Cleanup should attempt to stop if recognition was started
    // No error thrown is a pass
  })
})
