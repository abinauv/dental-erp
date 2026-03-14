// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

import { AIProvider, useAI } from '@/components/ai/ai-provider'

function wrapper({ children }: { children: React.ReactNode }) {
  return <AIProvider>{children}</AIProvider>
}

describe('useAI outside provider', () => {
  it('throws when used outside AIProvider', () => {
    expect(() => {
      renderHook(() => useAI())
    }).toThrow('useAI must be used inside <AIProvider>')
  })
})

describe('AIProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  it('provides empty chatMessages initially', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(result.current.chatMessages).toEqual([])
  })

  it('provides chatLoading as false initially', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(result.current.chatLoading).toBe(false)
  })

  it('provides commandLoading as false initially', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(result.current.commandLoading).toBe(false)
  })

  it('provides empty insights initially', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(result.current.insights).toEqual([])
  })

  it('provides insightsLoading as false initially', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(result.current.insightsLoading).toBe(false)
  })

  it('provides empty suggestions initially', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(result.current.suggestions).toEqual([])
  })

  it('exposes all expected functions', () => {
    const { result } = renderHook(() => useAI(), { wrapper })
    expect(typeof result.current.sendChat).toBe('function')
    expect(typeof result.current.clearChat).toBe('function')
    expect(typeof result.current.executeCommand).toBe('function')
    expect(typeof result.current.loadInsights).toBe('function')
    expect(typeof result.current.dismissInsight).toBe('function')
    expect(typeof result.current.generateInsights).toBe('function')
    expect(typeof result.current.loadSuggestions).toBe('function')
  })

  // clearChat
  it('clearChat resets messages to empty', async () => {
    // Simulate a failed fetch so sendChat adds an error message
    fetchMock.mockResolvedValue({ ok: false, text: async () => 'err' })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.sendChat('hello')
    })
    expect(result.current.chatMessages.length).toBeGreaterThan(0)

    act(() => {
      result.current.clearChat()
    })
    expect(result.current.chatMessages).toEqual([])
  })

  // sendChat error handling
  it('sendChat adds user message and error on failed response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => 'Server error',
    })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.sendChat('test question')
    })

    expect(result.current.chatMessages).toHaveLength(2)
    expect(result.current.chatMessages[0]).toEqual({ role: 'user', content: 'test question' })
    expect(result.current.chatMessages[1].role).toBe('assistant')
    expect(result.current.chatMessages[1].content).toContain('Error')
  })

  it('sendChat sets chatLoading during request', async () => {
    let resolveFetch: Function
    fetchMock.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve })
    )
    const { result } = renderHook(() => useAI(), { wrapper })

    let promise: Promise<void>
    act(() => {
      promise = result.current.sendChat('hi')
    })

    expect(result.current.chatLoading).toBe(true)

    await act(async () => {
      resolveFetch!({ ok: false, text: async () => 'err' })
      await promise!
    })

    expect(result.current.chatLoading).toBe(false)
  })

  // executeCommand
  it('executeCommand returns null on failed response', async () => {
    fetchMock.mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useAI(), { wrapper })

    let cmdResult: any
    await act(async () => {
      cmdResult = await result.current.executeCommand('test command')
    })
    expect(cmdResult).toBeNull()
  })

  it('executeCommand returns parsed JSON on success', async () => {
    const mockResult = { intent: 'test', summary: 'done', requiresApproval: false, result: {} }
    fetchMock.mockResolvedValue({ ok: true, json: async () => mockResult })
    const { result } = renderHook(() => useAI(), { wrapper })

    let cmdResult: any
    await act(async () => {
      cmdResult = await result.current.executeCommand('create patient')
    })
    expect(cmdResult).toEqual(mockResult)
  })

  it('executeCommand sends correct payload', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.executeCommand('book appointment', { patientId: 'p-1', page: 'appointments' })
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/command', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"command":"book appointment"'),
    }))
  })

  // loadInsights
  it('loadInsights fetches and sets insights', async () => {
    const mockInsights = [{ id: '1', title: 'Test', category: 'ops', severity: 'info', description: '', dismissed: false, actionTaken: false, createdAt: '' }]
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ insights: mockInsights }) })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.loadInsights()
    })
    expect(result.current.insights).toEqual(mockInsights)
  })

  it('loadInsights handles empty response', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.loadInsights()
    })
    expect(result.current.insights).toEqual([])
  })

  // dismissInsight
  it('dismissInsight removes insight from state', async () => {
    const mockInsights = [
      { id: '1', title: 'A', category: '', severity: '', description: '', dismissed: false, actionTaken: false, createdAt: '' },
      { id: '2', title: 'B', category: '', severity: '', description: '', dismissed: false, actionTaken: false, createdAt: '' },
    ]
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ insights: mockInsights }) })
      .mockResolvedValueOnce({ ok: true }) // dismiss PUT

    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.loadInsights()
    })
    expect(result.current.insights).toHaveLength(2)

    await act(async () => {
      await result.current.dismissInsight('1')
    })
    expect(result.current.insights).toHaveLength(1)
    expect(result.current.insights[0].id).toBe('2')
  })

  // generateInsights
  it('generateInsights appends new insights', async () => {
    const newInsights = [{ id: '3', title: 'New', category: '', severity: '', description: '', dismissed: false, actionTaken: false, createdAt: '' }]
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ insights: newInsights }) })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.generateInsights()
    })
    expect(result.current.insights).toHaveLength(1)
    expect(result.current.insights[0].id).toBe('3')
  })

  // loadSuggestions
  it('loadSuggestions fetches and sets suggestions', async () => {
    const mockSuggestions = [{ title: 'S1', description: 'desc', action: 'act', urgency: 'normal' }]
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ suggestions: mockSuggestions }) })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.loadSuggestions('dashboard')
    })
    expect(result.current.suggestions).toEqual(mockSuggestions)
  })

  it('loadSuggestions includes patientId in query params', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ suggestions: [] }) })
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.loadSuggestions('patients', 'p-123')
    })

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('page=patients')
    expect(url).toContain('patientId=p-123')
  })

  // Error resilience
  it('executeCommand returns null on network error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useAI(), { wrapper })

    let cmdResult: any
    await act(async () => {
      cmdResult = await result.current.executeCommand('test')
    })
    expect(cmdResult).toBeNull()
  })

  it('loadInsights handles fetch error silently', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useAI(), { wrapper })

    await act(async () => {
      await result.current.loadInsights()
    })
    // Should not throw, insights remain empty
    expect(result.current.insights).toEqual([])
  })
})
