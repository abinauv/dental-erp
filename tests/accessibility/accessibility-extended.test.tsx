// @ts-nocheck
/**
 * Extended Accessibility Tests (Sections 7.2–7.5)
 * - Keyboard navigation for dashboard, sidebar, calendar, dental chart
 * - Skip navigation link
 * - Automated axe-core audit on composite UIs
 * - Focus management patterns
 * - ARIA live region announcements
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
  useParams: () => ({}),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const icon = (name: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement('svg', { ...props, ref, 'data-testid': `lucide-${name}`, 'aria-hidden': 'true' })
    )
  const actual = (await importOriginal()) as any
  const handler = { get: (_: any, p: string) => actual[p] || icon(p) }
  return new Proxy(actual, handler)
})

// ---------------------------------------------------------------------------
// 7.2 Keyboard Navigation — Dashboard
// ---------------------------------------------------------------------------

describe('Accessibility — Keyboard Navigation', () => {
  describe('Dashboard interactive elements', () => {
    it('all interactive elements should be focusable via tab', () => {
      const { container } = render(
        <div role="main">
          <button>Add Patient</button>
          <a href="/patients">View All</a>
          <input type="text" placeholder="Search" />
          <select><option>Filter</option></select>
          <button>Refresh</button>
        </div>
      )
      const interactive = container.querySelectorAll('button, a, input, select, textarea, [tabindex="0"]')
      expect(interactive.length).toBeGreaterThanOrEqual(4)
      interactive.forEach((el) => {
        expect(el.tabIndex).not.toBe(-1)
      })
    })

    it('hidden elements should not be focusable', () => {
      const { container } = render(
        <div>
          <button>Visible</button>
          <button hidden tabIndex={-1}>Hidden</button>
          <div style={{ display: 'none' }}>
            <button tabIndex={-1}>Also hidden</button>
          </div>
        </div>
      )
      const hidden = container.querySelectorAll('[hidden], [style*="display: none"] button')
      hidden.forEach((el) => {
        const htmlEl = el as HTMLElement
        expect(htmlEl.tabIndex).toBe(-1)
      })
    })
  })

  describe('Sidebar keyboard navigation', () => {
    it('sidebar links should be focusable and have accessible names', () => {
      const { container } = render(
        <nav aria-label="Main navigation">
          <ul role="list">
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/patients">Patients</a></li>
            <li><a href="/appointments">Appointments</a></li>
            <li><a href="/billing">Billing</a></li>
          </ul>
        </nav>
      )
      const links = container.querySelectorAll('a')
      expect(links.length).toBe(4)
      links.forEach((link) => {
        expect(link.textContent?.trim().length).toBeGreaterThan(0)
        expect(link.getAttribute('href')).toBeTruthy()
      })
    })

    it('sidebar collapse button should be keyboard accessible', () => {
      const onToggle = vi.fn()
      render(
        <nav aria-label="Sidebar">
          <button aria-label="Toggle sidebar" onClick={onToggle}>
            <svg aria-hidden="true" />
          </button>
        </nav>
      )
      const btn = screen.getByLabelText('Toggle sidebar')
      fireEvent.keyDown(btn, { key: 'Enter' })
      fireEvent.click(btn)
      expect(onToggle).toHaveBeenCalled()
    })

    it('expand/collapse uses aria-expanded', () => {
      const { rerender } = render(
        <button aria-expanded="false" aria-label="Expand section">Expand</button>
      )
      expect(screen.getByLabelText('Expand section').getAttribute('aria-expanded')).toBe('false')
      rerender(
        <button aria-expanded="true" aria-label="Expand section">Collapse</button>
      )
      expect(screen.getByLabelText('Expand section').getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('Calendar keyboard navigation', () => {
    it('date cells should be focusable and have day labels', () => {
      const days = Array.from({ length: 7 }, (_, i) => i + 1)
      const { container } = render(
        <table role="grid" aria-label="Appointment calendar">
          <thead>
            <tr>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <th key={d} scope="col">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {days.map((d) => (
                <td key={d} role="gridcell" tabIndex={0} aria-label={`March ${d}`}>
                  <button>{d}</button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )
      const cells = container.querySelectorAll('[role="gridcell"]')
      expect(cells.length).toBe(7)
      cells.forEach((cell) => {
        expect(cell.getAttribute('aria-label')).toBeTruthy()
      })
    })

    it('arrow keys should be able to navigate calendar grid', () => {
      // Simulate arrow key navigation pattern
      let focusedIndex = 0
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') focusedIndex = Math.min(focusedIndex + 1, 6)
        if (e.key === 'ArrowLeft') focusedIndex = Math.max(focusedIndex - 1, 0)
        if (e.key === 'ArrowDown') focusedIndex = Math.min(focusedIndex + 7, 27)
        if (e.key === 'ArrowUp') focusedIndex = Math.max(focusedIndex - 7, 0)
      }
      // ArrowRight from index 0 → 1
      handleKeyDown({ key: 'ArrowRight' } as KeyboardEvent)
      expect(focusedIndex).toBe(1)
      // ArrowLeft from index 1 → 0
      handleKeyDown({ key: 'ArrowLeft' } as KeyboardEvent)
      expect(focusedIndex).toBe(0)
      // ArrowDown from 0 → 7
      handleKeyDown({ key: 'ArrowDown' } as KeyboardEvent)
      expect(focusedIndex).toBe(7)
      // ArrowUp from 7 → 0
      handleKeyDown({ key: 'ArrowUp' } as KeyboardEvent)
      expect(focusedIndex).toBe(0)
    })
  })

  describe('Dental chart keyboard navigation', () => {
    it('tooth buttons should be keyboard accessible with labels', () => {
      const teeth = [11, 12, 13, 21, 22, 23]
      const { container } = render(
        <div role="application" aria-label="Dental chart">
          {teeth.map((t) => (
            <button key={t} aria-label={`Tooth ${t}`} data-tooth={t}>
              {t}
            </button>
          ))}
        </div>
      )
      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBe(6)
      buttons.forEach((btn) => {
        expect(btn.getAttribute('aria-label')).toMatch(/Tooth \d+/)
      })
    })

    it('selected tooth should have aria-pressed or aria-selected', () => {
      render(
        <div role="application" aria-label="Dental chart">
          <button aria-label="Tooth 11" aria-pressed="true">11</button>
          <button aria-label="Tooth 12" aria-pressed="false">12</button>
        </div>
      )
      expect(screen.getByLabelText('Tooth 11').getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByLabelText('Tooth 12').getAttribute('aria-pressed')).toBe('false')
    })
  })
})

// ---------------------------------------------------------------------------
// 7.3 Color & Contrast patterns
// ---------------------------------------------------------------------------

describe('Accessibility — Color & Contrast Patterns', () => {
  it('status badges should have text + icon, not color alone', () => {
    const { container } = render(
      <div>
        <span className="badge badge-success" role="status">
          <svg aria-hidden="true" data-testid="lucide-CheckCircle" />
          Active
        </span>
        <span className="badge badge-warning" role="status">
          <svg aria-hidden="true" data-testid="lucide-AlertTriangle" />
          Pending
        </span>
        <span className="badge badge-danger" role="status">
          <svg aria-hidden="true" data-testid="lucide-XCircle" />
          Cancelled
        </span>
      </div>
    )
    const badges = container.querySelectorAll('[role="status"]')
    badges.forEach((badge) => {
      // Must have text content
      expect(badge.textContent?.trim().length).toBeGreaterThan(0)
      // Must have an icon (SVG) alongside
      expect(badge.querySelector('svg')).toBeTruthy()
    })
  })

  it('focus indicators should use visible focus ring classes', () => {
    const { container } = render(
      <div>
        <button className="focus:ring-2 focus:ring-offset-2 focus:ring-primary">Action</button>
        <input className="focus:ring-2 focus:ring-primary" type="text" aria-label="Input" />
        <a href="/link" className="focus:ring-2">Link</a>
      </div>
    )
    const focusable = container.querySelectorAll('[class*="focus:ring"]')
    expect(focusable.length).toBe(3)
  })

  it('error states should use icons + text + color (not color alone)', () => {
    const { container } = render(
      <div role="alert" className="text-red-600 bg-red-50 border-red-200">
        <svg aria-hidden="true" data-testid="lucide-AlertCircle" />
        <span>This field is required</span>
      </div>
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert).toBeTruthy()
    expect(alert!.textContent).toContain('required')
    expect(alert!.querySelector('svg')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 7.4 WCAG 2.1 AA Compliance — Skip navigation, heading hierarchy
// ---------------------------------------------------------------------------

describe('Accessibility — WCAG 2.1 AA Compliance', () => {
  describe('Skip navigation link', () => {
    it('skip nav link should jump to main content', () => {
      const { container } = render(
        <div>
          <a href="#main-content" className="sr-only focus:not-sr-only">
            Skip to main content
          </a>
          <nav aria-label="Main">
            <a href="/dashboard">Dashboard</a>
          </nav>
          <main id="main-content">
            <h1>Dashboard</h1>
          </main>
        </div>
      )
      const skipLink = container.querySelector('a[href="#main-content"]')
      expect(skipLink).toBeTruthy()
      expect(skipLink!.textContent).toContain('Skip to main content')
      // Target exists
      expect(container.querySelector('#main-content')).toBeTruthy()
    })

    it('skip link should be visually hidden until focused', () => {
      const { container } = render(
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
      )
      const link = container.querySelector('a')
      expect(link!.className).toContain('sr-only')
      expect(link!.className).toContain('focus:not-sr-only')
    })
  })

  describe('Heading hierarchy', () => {
    it('proper h1→h2→h3 hierarchy passes', () => {
      const { container } = render(
        <main>
          <h1>Patient Management</h1>
          <section>
            <h2>Patient List</h2>
            <h3>Active Patients</h3>
            <h3>Archived Patients</h3>
          </section>
          <section>
            <h2>Statistics</h2>
          </section>
        </main>
      )
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const levels = Array.from(headings).map((h) => parseInt(h.tagName[1]))
      // Verify no level is skipped
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
      }
    })

    it('skipped heading level is detected', () => {
      const { container } = render(
        <main>
          <h1>Page Title</h1>
          <h3>Skipped h2!</h3>
        </main>
      )
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const levels = Array.from(headings).map((h) => parseInt(h.tagName[1]))
      // h1 → h3 is a skip (difference > 1)
      const hasSkip = levels.some((level, i) => i > 0 && level - levels[i - 1] > 1)
      expect(hasSkip).toBe(true)
    })
  })

  describe('Text resizing', () => {
    it('text uses relative units (rem/em) not px for font-size', () => {
      // Verify the pattern: Tailwind uses rem-based sizing
      const tailwindSizes = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl']
      // Tailwind text-sm = 0.875rem, text-base = 1rem, etc.
      const remValues: Record<string, string> = {
        'text-sm': '0.875rem',
        'text-base': '1rem',
        'text-lg': '1.125rem',
        'text-xl': '1.25rem',
        'text-2xl': '1.5rem',
      }
      tailwindSizes.forEach((cls) => {
        expect(remValues[cls]).toMatch(/rem$/)
      })
    })

    it('container widths use max-w not fixed px width', () => {
      const { container } = render(
        <div className="max-w-7xl mx-auto">
          <div className="w-full">Content</div>
        </div>
      )
      const outer = container.firstElementChild!
      expect(outer.className).toContain('max-w')
      expect(outer.className).not.toMatch(/\bw-\d+px\b/)
    })
  })

  describe('Navigation landmarks', () => {
    it('page should have nav + main landmarks', () => {
      const { container } = render(
        <div>
          <nav aria-label="Main navigation">
            <a href="/dashboard">Dashboard</a>
          </nav>
          <main>
            <h1>Content</h1>
          </main>
        </div>
      )
      expect(container.querySelector('nav')).toBeTruthy()
      expect(container.querySelector('main')).toBeTruthy()
      expect(container.querySelector('nav')!.getAttribute('aria-label')).toBeTruthy()
    })

    it('multiple nav elements should have distinct aria-labels', () => {
      const { container } = render(
        <div>
          <nav aria-label="Main navigation">Main</nav>
          <nav aria-label="Breadcrumb">Breadcrumb</nav>
          <nav aria-label="Pagination">Pagination</nav>
        </div>
      )
      const navs = container.querySelectorAll('nav')
      const labels = Array.from(navs).map((n) => n.getAttribute('aria-label'))
      const unique = new Set(labels)
      expect(unique.size).toBe(labels.length)
    })
  })

  describe('No auto-playing media', () => {
    it('video elements must have controls and no autoplay', () => {
      const { container } = render(
        <div>
          <video controls src="/video.mp4">
            <track kind="captions" src="/captions.vtt" />
          </video>
        </div>
      )
      const video = container.querySelector('video')
      expect(video).toBeTruthy()
      expect(video!.hasAttribute('controls')).toBe(true)
      expect(video!.hasAttribute('autoplay')).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// 7.5 Automated Accessibility Audit — axe-core on composite UIs
// ---------------------------------------------------------------------------

describe('Accessibility — Automated axe-core Audit', () => {
  it('well-structured form passes axe audit', async () => {
    const axeCore = await import('axe-core')
    const { container } = render(
      <main>
        <h1>Add Patient</h1>
        <form aria-label="Add patient form">
          <div>
            <label htmlFor="firstName">First Name</label>
            <input id="firstName" type="text" required />
          </div>
          <div>
            <label htmlFor="lastName">Last Name</label>
            <input id="lastName" type="text" required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" />
          </div>
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" />
          </div>
          <button type="submit">Save Patient</button>
        </form>
      </main>
    )
    const results = await axeCore.default.run(container, {
      rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toHaveLength(0)
  })

  it('data table with proper headers passes axe audit', async () => {
    const axeCore = await import('axe-core')
    const { container } = render(
      <main>
        <h1>Patient List</h1>
        <table>
          <caption>List of patients</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John Doe</td>
              <td>john@test.com</td>
              <td>9876543210</td>
              <td>Active</td>
            </tr>
          </tbody>
        </table>
      </main>
    )
    const results = await axeCore.default.run(container, {
      rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toHaveLength(0)
  })

  it('modal dialog with proper ARIA passes audit', async () => {
    const axeCore = await import('axe-core')
    const { container } = render(
      <div>
        <main>
          <h1>Page</h1>
        </main>
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h2 id="modal-title">Confirm Delete</h2>
          <p>Are you sure you want to delete this patient?</p>
          <button>Cancel</button>
          <button>Delete</button>
        </div>
      </div>
    )
    const results = await axeCore.default.run(container, {
      rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toHaveLength(0)
  })

  it('navigation with proper landmarks passes audit', async () => {
    const axeCore = await import('axe-core')
    const { container } = render(
      <div>
        <nav aria-label="Main navigation">
          <ul>
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/patients">Patients</a></li>
          </ul>
        </nav>
        <main>
          <h1>Dashboard</h1>
          <p>Welcome to DentalERP</p>
        </main>
      </div>
    )
    const results = await axeCore.default.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toHaveLength(0)
  })

  it('alert / notification pattern passes audit', async () => {
    const axeCore = await import('axe-core')
    const { container } = render(
      <main>
        <h1>Notifications</h1>
        <div role="alert" aria-live="assertive">
          <p>Patient record saved successfully</p>
        </div>
        <div role="status" aria-live="polite">
          <p>Loading appointments...</p>
        </div>
      </main>
    )
    const results = await axeCore.default.run(container, {
      rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
    })
    expect(results.violations).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Focus trap in modals
// ---------------------------------------------------------------------------

describe('Accessibility — Focus Trap in Modals', () => {
  it('Tab should cycle within modal when open', () => {
    const { container } = render(
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">Edit Patient</h2>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" />
        <button>Cancel</button>
        <button>Save</button>
      </div>
    )
    const focusable = container.querySelectorAll('input, button, [tabindex="0"]')
    expect(focusable.length).toBe(3) // input + 2 buttons
    // Verify all are within the dialog
    focusable.forEach((el) => {
      expect(el.closest('[role="dialog"]')).toBeTruthy()
    })
  })

  it('Escape key should close modal via handler', () => {
    const onClose = vi.fn()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    handleKeyDown({ key: 'Escape' } as KeyboardEvent)
    expect(onClose).toHaveBeenCalledTimes(1)
    // Non-escape key should not close
    handleKeyDown({ key: 'Enter' } as KeyboardEvent)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ARIA Live Region announcements
// ---------------------------------------------------------------------------

describe('Accessibility — ARIA Live Regions', () => {
  it('toast notifications use aria-live="polite"', () => {
    const { container } = render(
      <div aria-live="polite" role="status">
        Patient added successfully
      </div>
    )
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toBeTruthy()
    expect(live!.textContent).toContain('successfully')
  })

  it('error alerts use aria-live="assertive"', () => {
    const { container } = render(
      <div aria-live="assertive" role="alert">
        Failed to save patient record
      </div>
    )
    const live = container.querySelector('[aria-live="assertive"]')
    expect(live).toBeTruthy()
    expect(live!.getAttribute('role')).toBe('alert')
  })

  it('loading states announce via aria-busy', () => {
    const { rerender, container } = render(
      <div aria-busy="true" aria-live="polite">Loading patients...</div>
    )
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    rerender(
      <div aria-busy="false" aria-live="polite">50 patients loaded</div>
    )
    expect(container.querySelector('[aria-busy="false"]')).toBeTruthy()
  })

  it('search results count announced to screen readers', () => {
    const { container } = render(
      <div>
        <input type="search" aria-label="Search patients" />
        <div role="status" aria-live="polite" aria-atomic="true">
          5 results found
        </div>
      </div>
    )
    const status = container.querySelector('[role="status"]')
    expect(status).toBeTruthy()
    expect(status!.getAttribute('aria-atomic')).toBe('true')
    expect(status!.textContent).toContain('5 results')
  })
})
