// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock SpeechRecognition
const mockRecognition = {
  continuous: false,
  interimResults: false,
  lang: '',
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onresult: null as any,
  onerror: null as any,
  onend: null as any,
  onspeechend: null as any,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}

const MockSpeechRecognition = vi.fn(() => ({ ...mockRecognition }))

// Mock speechSynthesis
const mockUtterance: any = {}
const MockSpeechSynthesisUtterance = vi.fn(() => mockUtterance)

const mockSpeechSynthesis = {
  cancel: vi.fn(),
  speak: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
}

// Mock navigator.mediaDevices
const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
}

const mockAudioContext = {
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
  }),
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
  }),
  close: vi.fn().mockResolvedValue(undefined),
}

import { useWebVoice } from '@/hooks/use-web-voice'

describe('useWebVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Set up browser APIs
    ;(window as any).webkitSpeechRecognition = MockSpeechRecognition
    ;(window as any).SpeechRecognition = undefined
    ;(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance
    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
      },
      writable: true,
      configurable: true,
    })
    ;(window as any).AudioContext = vi.fn(() => mockAudioContext)
    // Stub requestAnimationFrame to avoid infinite loop
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      // Don't call cb to avoid infinite tick loop
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as any).webkitSpeechRecognition
    delete (window as any).SpeechRecognition
  })

  it('returns idle state initially', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.state).toBe('idle')
  })

  it('detects voice support', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.voiceSupported).toBe(true)
  })

  it('detects no voice support when SpeechRecognition is absent', () => {
    delete (window as any).webkitSpeechRecognition
    delete (window as any).SpeechRecognition
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.voiceSupported).toBe(false)
  })

  it('returns empty transcript initially', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.transcript).toBe('')
    expect(result.current.interimTranscript).toBe('')
  })

  it('ttsEnabled is false initially', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.ttsEnabled).toBe(false)
  })

  it('handsFreeMode is false initially', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.handsFreeMode).toBe(false)
  })

  it('audioLevel is 0 initially', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.audioLevel).toBe(0)
  })

  it('startListening sets state to listening', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    expect(result.current.state).toBe('listening')
  })

  it('startListening creates SpeechRecognition instance', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    expect(MockSpeechRecognition).toHaveBeenCalled()
  })

  it('startListening sets lang from options', () => {
    const { result } = renderHook(() => useWebVoice({ lang: 'hi-IN' }))
    act(() => {
      result.current.startListening()
    })
    const instance = MockSpeechRecognition.mock.results[0].value
    expect(instance.lang).toBe('hi-IN')
  })

  it('defaults lang to en-IN', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    const instance = MockSpeechRecognition.mock.results[0].value
    expect(instance.lang).toBe('en-IN')
  })

  it('stopListening sets state to idle', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    act(() => {
      result.current.stopListening()
    })
    expect(result.current.state).toBe('idle')
  })

  it('stopListening calls recognition.stop()', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    const instance = MockSpeechRecognition.mock.results[0].value
    act(() => {
      result.current.stopListening()
    })
    expect(instance.stop).toHaveBeenCalled()
  })

  it('toggleTts toggles ttsEnabled', () => {
    const { result } = renderHook(() => useWebVoice())
    expect(result.current.ttsEnabled).toBe(false)
    act(() => {
      result.current.toggleTts()
    })
    expect(result.current.ttsEnabled).toBe(true)
    act(() => {
      result.current.toggleTts()
    })
    expect(result.current.ttsEnabled).toBe(false)
  })

  it('toggleTts cancels speech when disabling', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.toggleTts() // enable
    })
    act(() => {
      result.current.toggleTts() // disable
    })
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled()
  })

  it('speakText calls speechSynthesis.speak', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.speakText('Hello world')
    })
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
    expect(result.current.state).toBe('speaking')
  })

  it('speakText cancels previous speech first', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.speakText('Hello')
    })
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled()
  })

  it('speakText strips markdown from text', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.speakText('**bold** and *italic*')
    })
    const utteranceArg = MockSpeechSynthesisUtterance.mock.calls[0][0]
    expect(utteranceArg).not.toContain('**')
    expect(utteranceArg).not.toContain('*')
  })

  it('stopSpeaking cancels synthesis and sets idle', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.speakText('Hello')
    })
    act(() => {
      result.current.stopSpeaking()
    })
    expect(result.current.state).toBe('idle')
  })

  it('interruptSpeaking stops speaking', () => {
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.speakText('Hello')
    })
    act(() => {
      result.current.interruptSpeaking()
    })
    expect(result.current.state).toBe('idle')
  })

  it('does not start listening when SpeechRecognition is absent', () => {
    delete (window as any).webkitSpeechRecognition
    delete (window as any).SpeechRecognition
    const { result } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    expect(result.current.state).toBe('idle')
  })

  it('cleans up on unmount', () => {
    const { result, unmount } = renderHook(() => useWebVoice())
    act(() => {
      result.current.startListening()
    })
    unmount()
    // Should not throw
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled()
  })
})
