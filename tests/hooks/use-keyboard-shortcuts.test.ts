// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { useKeyboardShortcuts, useHotkey } from '@/hooks/use-keyboard-shortcuts'

function fireKey(
  key: string,
  opts: Partial<KeyboardEventInit> = {},
  target?: HTMLElement
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }
  window.dispatchEvent(event)
  return event
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls extra shortcut handler for matching key', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    fireKey('a')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire shortcut when typing in INPUT', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does not fire shortcut when typing in TEXTAREA', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('does not fire shortcut when typing in SELECT', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    const select = document.createElement('select')
    document.body.appendChild(select)
    select.focus()
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(select)
  })

  it('does not fire shortcut when typing in contentEditable', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    const div = document.createElement('div')
    div.contentEditable = 'true'
    // jsdom doesn't support isContentEditable, so we polyfill it
    Object.defineProperty(div, 'isContentEditable', { value: true })
    document.body.appendChild(div)
    div.focus()
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(div)
  })

  it('ignores meta key combos', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    fireKey('a', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores ctrl key combos', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    fireKey('a', { ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores alt key combos', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ a: handler }))
    fireKey('a', { altKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('cleans up listener on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts({ x: handler }))
    unmount()
    fireKey('x')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('useHotkey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fires callback for matching simple key', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('n', cb))
    fireKey('n')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('is case-insensitive for key matching', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('n', cb))
    fireKey('N')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fires callback for ctrl+k combo', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('ctrl+k', cb))
    fireKey('k', { ctrlKey: true })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fires callback for meta+k combo', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('ctrl+k', cb))
    fireKey('k', { metaKey: true })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not fire ctrl combo without modifier', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('ctrl+k', cb))
    fireKey('k')
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires callback for shift combo', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('shift+?', cb))
    fireKey('?', { shiftKey: true })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not fire shift combo without modifier', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('shift+a', cb))
    fireKey('a')
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires callback for alt combo', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('alt+s', cb))
    fireKey('s', { altKey: true })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not fire inside INPUT elements', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('n', cb))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
    expect(cb).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('fires Escape even inside INPUT elements', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('escape', cb))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cb).toHaveBeenCalledTimes(1)
    document.body.removeChild(input)
  })

  it('fires Escape inside TEXTAREA', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('escape', cb))
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cb).toHaveBeenCalledTimes(1)
    document.body.removeChild(textarea)
  })

  it('cleans up listener on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useHotkey('n', cb))
    unmount()
    fireKey('n')
    expect(cb).not.toHaveBeenCalled()
  })

  it('prevents default on matched key', () => {
    const cb = vi.fn()
    renderHook(() => useHotkey('n', cb))
    const event = fireKey('n')
    expect(event.defaultPrevented).toBe(true)
  })
})
