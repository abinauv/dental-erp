// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// We test the reducer directly (pure function) and the toast/useToast via renderHook

// Import reducer directly — it's exported
import { reducer } from '@/hooks/use-toast'

describe('use-toast reducer', () => {
  const makeToast = (id: string, title = 'Test') => ({
    id,
    title,
    open: true,
    onOpenChange: vi.fn(),
  })

  it('ADD_TOAST adds a toast to the beginning', () => {
    const state = { toasts: [] }
    const toast = makeToast('1')
    const result = reducer(state, { type: 'ADD_TOAST', toast })
    expect(result.toasts).toHaveLength(1)
    expect(result.toasts[0].id).toBe('1')
  })

  it('ADD_TOAST limits to TOAST_LIMIT (1)', () => {
    const state = { toasts: [makeToast('existing')] }
    const toast = makeToast('new')
    const result = reducer(state, { type: 'ADD_TOAST', toast })
    expect(result.toasts).toHaveLength(1)
    expect(result.toasts[0].id).toBe('new')
  })

  it('UPDATE_TOAST updates matching toast', () => {
    const state = { toasts: [makeToast('1', 'Old')] }
    const result = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '1', title: 'New' },
    })
    expect(result.toasts[0].title).toBe('New')
  })

  it('UPDATE_TOAST does not affect non-matching toast', () => {
    const state = { toasts: [makeToast('1', 'Original')] }
    const result = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '2', title: 'New' },
    })
    expect(result.toasts[0].title).toBe('Original')
  })

  it('DISMISS_TOAST sets open to false for specific toast', () => {
    const state = { toasts: [makeToast('1')] }
    const result = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' })
    expect(result.toasts[0].open).toBe(false)
  })

  it('DISMISS_TOAST without id dismisses all toasts', () => {
    const t1 = makeToast('1')
    const t2 = makeToast('2')
    // Reducer only keeps 1 due to limit, but testing with pre-filled state
    const state = { toasts: [t1, t2] }
    const result = reducer(state, { type: 'DISMISS_TOAST' })
    result.toasts.forEach((t) => expect(t.open).toBe(false))
  })

  it('REMOVE_TOAST removes specific toast', () => {
    const state = { toasts: [makeToast('1')] }
    const result = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' })
    expect(result.toasts).toHaveLength(0)
  })

  it('REMOVE_TOAST without id removes all toasts', () => {
    const state = { toasts: [makeToast('1'), makeToast('2')] }
    const result = reducer(state, { type: 'REMOVE_TOAST' })
    expect(result.toasts).toHaveLength(0)
  })

  it('REMOVE_TOAST does not remove non-matching toast', () => {
    const state = { toasts: [makeToast('1')] }
    const result = reducer(state, { type: 'REMOVE_TOAST', toastId: '999' })
    expect(result.toasts).toHaveLength(1)
  })
})

describe('useToast hook', () => {
  // We need a fresh import each time to reset module-level state
  // Since module state persists, we test the public API
  let useToast: () => any
  let toast: (props: any) => any

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/hooks/use-toast')
    useToast = mod.useToast
    toast = mod.toast
  })

  it('returns empty toasts initially', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it('returns a toast function', () => {
    const { result } = renderHook(() => useToast())
    expect(typeof result.current.toast).toBe('function')
  })

  it('returns a dismiss function', () => {
    const { result } = renderHook(() => useToast())
    expect(typeof result.current.dismiss).toBe('function')
  })

  it('toast() returns id, dismiss, and update', () => {
    renderHook(() => useToast())
    let toastResult: any
    act(() => {
      toastResult = toast({ title: 'Test' })
    })
    expect(toastResult.id).toBeDefined()
    expect(typeof toastResult.dismiss).toBe('function')
    expect(typeof toastResult.update).toBe('function')
  })

  it('toast() adds toast to state', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      toast({ title: 'Hello' })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].title).toBe('Hello')
    expect(result.current.toasts[0].open).toBe(true)
  })

  it('dismiss() sets toast open to false', () => {
    const { result } = renderHook(() => useToast())
    let id: string
    act(() => {
      id = toast({ title: 'Hello' }).id
    })
    act(() => {
      result.current.dismiss(id)
    })
    expect(result.current.toasts[0].open).toBe(false)
  })

  it('genId produces unique IDs', () => {
    renderHook(() => useToast())
    const ids = new Set<string>()
    act(() => {
      for (let i = 0; i < 10; i++) {
        // Each toast replaces previous (limit=1), but id is unique
        ids.add(toast({ title: `T${i}` }).id)
      }
    })
    expect(ids.size).toBe(10)
  })
})
