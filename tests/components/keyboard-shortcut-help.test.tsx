// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children, onOpenChange }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

// Track the hotkey callbacks
const hotkeyCallbacks: Record<string, Function> = {}
vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useHotkey: (key: string, cb: Function) => {
    hotkeyCallbacks[key] = cb
  },
}))

import { KeyboardShortcutHelp } from '@/components/layout/keyboard-shortcut-help'

describe('KeyboardShortcutHelp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(hotkeyCallbacks).forEach((k) => delete hotkeyCallbacks[k])
  })

  it('does not show dialog by default', () => {
    render(<KeyboardShortcutHelp />)
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })

  it('registers "?" hotkey', () => {
    render(<KeyboardShortcutHelp />)
    expect(hotkeyCallbacks['?']).toBeDefined()
  })

  it('registers "n" hotkey for navigation', () => {
    render(<KeyboardShortcutHelp />)
    expect(hotkeyCallbacks['n']).toBeDefined()
  })

  it('opens dialog when "?" hotkey fires', () => {
    render(<KeyboardShortcutHelp />)
    act(() => { hotkeyCallbacks['?']() })
    expect(screen.getByTestId('dialog')).toBeInTheDocument()
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('shows Navigation section', () => {
    render(<KeyboardShortcutHelp />)
    act(() => { hotkeyCallbacks['?']() })
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Open search')).toBeInTheDocument()
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument()
  })

  it('shows Quick Actions section', () => {
    render(<KeyboardShortcutHelp />)
    act(() => { hotkeyCallbacks['?']() })
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('New patient')).toBeInTheDocument()
    expect(screen.getByText('New appointment')).toBeInTheDocument()
    expect(screen.getByText('New invoice')).toBeInTheDocument()
  })

  it('shows General section', () => {
    render(<KeyboardShortcutHelp />)
    act(() => { hotkeyCallbacks['?']() })
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Close dialog / modal')).toBeInTheDocument()
    expect(screen.getByText('Open AI command bar')).toBeInTheDocument()
  })

  it('renders kbd elements for keys', () => {
    render(<KeyboardShortcutHelp />)
    act(() => { hotkeyCallbacks['?']() })
    const kbds = screen.getAllByText('/', { selector: 'kbd' })
    expect(kbds.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "then" separator for multi-key shortcuts', () => {
    render(<KeyboardShortcutHelp />)
    act(() => { hotkeyCallbacks['?']() })
    const thenElements = screen.getAllByText('then')
    expect(thenElements.length).toBeGreaterThanOrEqual(3)
  })
})
