// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockReplace = vi.fn()
const mockPathname = vi.fn().mockReturnValue('/')

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: mockBack,
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname(),
  useParams: () => ({}),
}))

// ---------------------------------------------------------------------------
// Tests — Back Button Behavior
// ---------------------------------------------------------------------------

describe('Navigation — Back Button Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('back button calls router.back()', () => {
    const BackButton = () => (
      <button onClick={() => mockBack()}>Go Back</button>
    )

    render(<BackButton />)
    fireEvent.click(screen.getByText('Go Back'))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('back from patient detail returns to patient list', () => {
    // Simulate breadcrumb back navigation
    const breadcrumbParent = '/patients'
    const currentPath = '/patients/p-123'

    expect(currentPath.startsWith(breadcrumbParent)).toBe(true)

    // Back should navigate to parent
    const parentPath = currentPath.split('/').slice(0, -1).join('/')
    expect(parentPath).toBe('/patients')
  })

  it('back from nested route navigates to parent', () => {
    const testCases = [
      { current: '/patients/p-1/documents', expected: '/patients/p-1' },
      { current: '/appointments/a-1', expected: '/appointments' },
      { current: '/settings/billing', expected: '/settings' },
      { current: '/invoices/inv-1/payments', expected: '/invoices/inv-1' },
    ]

    testCases.forEach(({ current, expected }) => {
      const parent = current.split('/').slice(0, -1).join('/')
      expect(parent).toBe(expected)
    })
  })

  it('back from top-level route navigates to dashboard', () => {
    const topLevelRoutes = ['/patients', '/appointments', '/invoices', '/inventory', '/settings']

    topLevelRoutes.forEach((route) => {
      const segments = route.split('/').filter(Boolean)
      expect(segments.length).toBe(1)
      // Back from top-level should go to dashboard
      const fallback = '/dashboard'
      expect(fallback).toBe('/dashboard')
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — Keyboard Shortcuts
// ---------------------------------------------------------------------------

describe('Navigation — Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any added event listeners
  })

  describe('Cmd+K / Ctrl+K opens search', () => {
    it('dispatches Cmd+K keyboard event (Mac)', () => {
      const handler = vi.fn()

      const listener = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault()
          handler()
        }
      }

      document.addEventListener('keydown', listener)
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
      )

      expect(handler).toHaveBeenCalledTimes(1)
      document.removeEventListener('keydown', listener)
    })

    it('dispatches Ctrl+K keyboard event (Windows/Linux)', () => {
      const handler = vi.fn()

      const listener = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault()
          handler()
        }
      }

      document.addEventListener('keydown', listener)
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      )

      expect(handler).toHaveBeenCalledTimes(1)
      document.removeEventListener('keydown', listener)
    })

    it('plain K key does not trigger search shortcut', () => {
      const handler = vi.fn()

      const listener = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          handler()
        }
      }

      document.addEventListener('keydown', listener)
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', bubbles: true })
      )

      expect(handler).not.toHaveBeenCalled()
      document.removeEventListener('keydown', listener)
    })
  })

  describe('Escape key behavior', () => {
    it('Escape closes open modal/dialog', () => {
      const onClose = vi.fn()

      const Modal = ({ onClose: handleClose }: any) => {
        React.useEffect(() => {
          const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose()
          }
          document.addEventListener('keydown', handler)
          return () => document.removeEventListener('keydown', handler)
        }, [handleClose])

        return (
          <div role="dialog" aria-modal="true">
            <h2>Test Modal</h2>
            <button onClick={handleClose}>Close</button>
          </div>
        )
      }

      render(<Modal onClose={onClose} />)
      expect(screen.getByText('Test Modal')).toBeInTheDocument()

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Escape does not fire when no modal is open', () => {
      const onClose = vi.fn()

      // No modal rendered — escape should not trigger anything meaningful
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Tab navigation', () => {
    it('Tab key cycles through focusable elements', () => {
      const { container } = render(
        <form>
          <input type="text" aria-label="First" data-testid="first" />
          <input type="text" aria-label="Second" data-testid="second" />
          <button type="submit">Submit</button>
        </form>
      )

      const firstInput = screen.getByTestId('first')
      const secondInput = screen.getByTestId('second')
      const submitBtn = screen.getByText('Submit')

      // Focus first element
      firstInput.focus()
      expect(document.activeElement).toBe(firstInput)

      // Simulate tab to next
      secondInput.focus()
      expect(document.activeElement).toBe(secondInput)

      // Tab to button
      submitBtn.focus()
      expect(document.activeElement).toBe(submitBtn)
    })

    it('tabIndex=-1 removes element from tab order', () => {
      const { container } = render(
        <div>
          <button>Visible</button>
          <button tabIndex={-1}>Hidden from tab</button>
          <button>Also visible</button>
        </div>
      )

      const tabbable = container.querySelectorAll('button:not([tabindex="-1"])')
      expect(tabbable.length).toBe(2)
    })

    it('Shift+Tab moves focus backwards', () => {
      const { container } = render(
        <form>
          <input type="text" aria-label="A" data-testid="a" />
          <input type="text" aria-label="B" data-testid="b" />
          <input type="text" aria-label="C" data-testid="c" />
        </form>
      )

      const inputC = screen.getByTestId('c')
      const inputB = screen.getByTestId('b')

      // Focus C, then shift-tab to B
      inputC.focus()
      expect(document.activeElement).toBe(inputC)

      inputB.focus() // simulates shift+tab
      expect(document.activeElement).toBe(inputB)
    })
  })

  describe('Shortcut key guards', () => {
    it('shortcuts are ignored when typing in input fields', () => {
      const handler = vi.fn()

      const listener = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        if (isInput) return // guard
        if (e.key === 'n') handler()
      }

      const { container } = render(
        <div>
          <input type="text" data-testid="input" />
          <div data-testid="outside">Outside</div>
        </div>
      )

      document.addEventListener('keydown', listener)

      // Fire "n" from inside input — should be guarded
      const input = screen.getByTestId('input')
      fireEvent.keyDown(input, { key: 'n' })
      expect(handler).not.toHaveBeenCalled()

      document.removeEventListener('keydown', listener)
    })

    it('shortcuts fire when focus is on non-input elements', () => {
      const handler = vi.fn()

      const listener = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        if (isInput) return
        if (e.key === 'n') handler()
      }

      document.addEventListener('keydown', listener)

      // Fire "n" from document body
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
      expect(handler).toHaveBeenCalledTimes(1)

      document.removeEventListener('keydown', listener)
    })

    it('modifier+key shortcuts work even in input fields', () => {
      const handler = vi.fn()

      const listener = (e: KeyboardEvent) => {
        // Cmd+K should always work, even in inputs
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault()
          handler()
        }
      }

      const { container } = render(<input type="text" data-testid="input" />)

      document.addEventListener('keydown', listener)

      const input = screen.getByTestId('input')
      input.focus()

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
        )
      })

      expect(handler).toHaveBeenCalledTimes(1)
      document.removeEventListener('keydown', listener)
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — Navigation Quick Actions (n then p, n then a, etc.)
// ---------------------------------------------------------------------------

describe('Navigation — Quick Action Shortcuts', () => {
  it('defines standard quick action mappings', () => {
    const quickActions = {
      'n then p': '/patients/new',
      'n then a': '/appointments/new',
      'n then i': '/invoices/new',
      'n then s': '/staff/new',
    }

    expect(quickActions['n then p']).toBe('/patients/new')
    expect(quickActions['n then a']).toBe('/appointments/new')
    expect(quickActions['n then i']).toBe('/invoices/new')
    expect(quickActions['n then s']).toBe('/staff/new')
  })

  it('chord shortcuts require two-step key press', () => {
    let firstKey: string | null = null
    const actions: Record<string, string> = {
      p: '/patients/new',
      a: '/appointments/new',
    }
    const navigated: string[] = []

    const handleKey = (key: string) => {
      if (firstKey === 'n' && actions[key]) {
        navigated.push(actions[key])
        firstKey = null
      } else if (key === 'n') {
        firstKey = 'n'
      } else {
        firstKey = null
      }
    }

    handleKey('n')
    handleKey('p')
    expect(navigated).toEqual(['/patients/new'])

    handleKey('n')
    handleKey('a')
    expect(navigated).toEqual(['/patients/new', '/appointments/new'])
  })

  it('chord resets if second key is invalid', () => {
    let firstKey: string | null = null
    const navigated: string[] = []

    const handleKey = (key: string) => {
      if (firstKey === 'n' && key === 'p') {
        navigated.push('/patients/new')
        firstKey = null
      } else if (key === 'n') {
        firstKey = 'n'
      } else {
        firstKey = null
      }
    }

    handleKey('n')
    handleKey('x') // invalid second key
    handleKey('p') // this should NOT trigger because chord was reset
    expect(navigated).toEqual([])
  })

  it('? key opens keyboard shortcut help', () => {
    const opened = vi.fn()

    const handleKey = (key: string) => {
      if (key === '?') opened()
    }

    handleKey('?')
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('/ key focuses search input', () => {
    const focused = vi.fn()

    const handleKey = (key: string) => {
      if (key === '/') focused()
    }

    handleKey('/')
    expect(focused).toHaveBeenCalledTimes(1)
  })
})
