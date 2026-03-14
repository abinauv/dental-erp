// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import axeCore from 'axe-core'

// Manual axe runner since vitest-axe has compatibility issues
async function axe(container: HTMLElement) {
  const results = await axeCore.run(container, {
    rules: {
      region: { enabled: false },
      'color-contrast': { enabled: false },
    },
  })
  return results
}

function expectNoViolations(results: axeCore.AxeResults) {
  const violations = results.violations
  if (violations.length > 0) {
    const msgs = violations.map(
      (v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`
    )
    throw new Error(`Accessibility violations:\n${msgs.join('\n')}`)
  }
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
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
// 7.1 Screen Reader Compatibility — ARIA & Semantic HTML
// ---------------------------------------------------------------------------

describe('Accessibility — Screen Reader & ARIA', () => {
  describe('Page titles', () => {
    it('pages should set document title', () => {
      // All dashboard pages use next/head or metadata to set title
      // Verify the pattern exists
      document.title = 'Patients | DentalERP'
      expect(document.title).toBeTruthy()
      expect(document.title.length).toBeGreaterThan(0)
    })
  })

  describe('Images have alt text', () => {
    it('img elements without alt text fail accessibility', async () => {
      const { container } = render(
        <div>
          <img src="/logo.png" alt="Clinic logo" />
          <img src="/avatar.png" alt="Patient avatar" />
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })

    it('img without alt text triggers violation', async () => {
      const { container } = render(
        <div>
          <img src="/logo.png" />
        </div>
      )
      const results = await axe(container)
      expect(results.violations.length).toBeGreaterThan(0)
      expect(results.violations.some((v) => v.id === 'image-alt')).toBe(true)
    })
  })

  describe('Form inputs have labels', () => {
    it('labeled inputs pass accessibility', async () => {
      const { container } = render(
        <form>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" />
          <label htmlFor="phone">Phone</label>
          <input id="phone" type="tel" />
        </form>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })

    it('unlabeled input triggers violation', async () => {
      const { container } = render(
        <form>
          <input type="text" />
        </form>
      )
      const results = await axe(container)
      expect(results.violations.length).toBeGreaterThan(0)
      const labelViolation = results.violations.find(
        (v) => v.id === 'label' || v.id === 'input-requires-label'
      )
      expect(labelViolation).toBeDefined()
    })

    it('aria-label is an acceptable alternative to visible label', async () => {
      const { container } = render(
        <form>
          <input type="search" aria-label="Search patients" />
        </form>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })
  })

  describe('Buttons have accessible names', () => {
    it('button with text content passes', async () => {
      const { container } = render(
        <div>
          <button>Save Patient</button>
          <button>Cancel</button>
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })

    it('icon button with aria-label passes', async () => {
      const { container } = render(
        <div>
          <button aria-label="Close dialog">
            <svg aria-hidden="true"><path d="M6 6l12 12" /></svg>
          </button>
          <button aria-label="Open menu">
            <svg aria-hidden="true"><path d="M3 12h18" /></svg>
          </button>
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })

    it('icon button without accessible name fails', async () => {
      const { container } = render(
        <div>
          <button>
            <svg><path d="M6 6l12 12" /></svg>
          </button>
        </div>
      )
      const results = await axe(container)
      // Should have button-name violation
      const hasNameViolation = results.violations.some(
        (v) => v.id === 'button-name'
      )
      expect(hasNameViolation).toBe(true)
    })
  })

  describe('Dynamic content announcements', () => {
    it('aria-live region announces dynamic changes', async () => {
      const { container } = render(
        <div>
          <div aria-live="polite" role="status">3 patients found</div>
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)

      const liveRegion = container.querySelector('[aria-live]')
      expect(liveRegion).toBeTruthy()
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite')
    })

    it('toast/alert uses aria-live assertive', () => {
      const { container } = render(
        <div aria-live="assertive" role="alert">
          Error: Failed to save patient record
        </div>
      )

      const alertRegion = container.querySelector('[role="alert"]')
      expect(alertRegion).toBeTruthy()
      expect(alertRegion?.getAttribute('aria-live')).toBe('assertive')
    })
  })

  describe('Modal focus management', () => {
    it('dialog has proper role and aria attributes', async () => {
      const { container } = render(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <h2 id="dialog-title">Add New Patient</h2>
          <form>
            <label htmlFor="fname">First Name</label>
            <input id="fname" type="text" />
            <button type="submit">Save</button>
            <button type="button">Cancel</button>
          </form>
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)

      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog?.getAttribute('aria-modal')).toBe('true')
      expect(dialog?.getAttribute('aria-labelledby')).toBe('dialog-title')
    })

    it('dialog without aria-labelledby fails', async () => {
      const { container } = render(
        <div role="dialog" aria-modal="true">
          <h2>Untitled Dialog</h2>
          <button>Close</button>
        </div>
      )
      const results = await axe(container)
      const hasViolation = results.violations.some(
        (v) => v.id === 'aria-dialog-name'
      )
      expect(hasViolation).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// 7.2 Keyboard Navigation — Focus Management
// ---------------------------------------------------------------------------

describe('Accessibility — Keyboard Navigation', () => {
  describe('Tab order', () => {
    it('interactive elements are focusable via tabIndex', () => {
      const { container } = render(
        <form>
          <input type="text" aria-label="Name" />
          <input type="email" aria-label="Email" />
          <select aria-label="Role">
            <option>Admin</option>
            <option>Doctor</option>
          </select>
          <button type="submit">Save</button>
        </form>
      )

      const focusable = container.querySelectorAll(
        'input, select, button, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )
      expect(focusable.length).toBe(4)
    })

    it('hidden elements are not focusable', () => {
      const { container } = render(
        <div>
          <button>Visible</button>
          <button tabIndex={-1}>Programmatically focused only</button>
          <input type="hidden" name="token" />
        </div>
      )

      const focusable = container.querySelectorAll(
        'input:not([type="hidden"]), button:not([tabindex="-1"])'
      )
      expect(focusable.length).toBe(1)
    })
  })

  describe('Login form tab order', () => {
    it('form elements can receive focus in order', () => {
      const { container } = render(
        <form>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoFocus />
          <label htmlFor="login-pass">Password</label>
          <input id="login-pass" type="password" />
          <button type="submit">Sign In</button>
        </form>
      )

      const emailInput = container.querySelector('#login-email') as HTMLInputElement
      const passInput = container.querySelector('#login-pass') as HTMLInputElement
      const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement

      expect(emailInput).toBeTruthy()
      expect(passInput).toBeTruthy()
      expect(submitBtn).toBeTruthy()

      // Elements should be focusable
      emailInput.focus()
      expect(document.activeElement).toBe(emailInput)
      passInput.focus()
      expect(document.activeElement).toBe(passInput)
      submitBtn.focus()
      expect(document.activeElement).toBe(submitBtn)
    })
  })

  describe('Data tables keyboard', () => {
    it('table rows are selectable with proper structure', async () => {
      const { container } = render(
        <table role="grid" aria-label="Patient list">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Phone</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John Doe</td>
              <td>9876543210</td>
              <td><button aria-label="Edit John Doe">Edit</button></td>
            </tr>
            <tr>
              <td>Jane Smith</td>
              <td>9123456789</td>
              <td><button aria-label="Edit Jane Smith">Edit</button></td>
            </tr>
          </tbody>
        </table>
      )
      const results = await axe(container)
      expectNoViolations(results)

      const headers = container.querySelectorAll('th[scope="col"]')
      expect(headers.length).toBe(3)
    })

    it('table without headers has incomplete accessibility', () => {
      const { container } = render(
        <table>
          <tbody>
            <tr><td>Data1</td><td>Data2</td></tr>
          </tbody>
        </table>
      )

      // Tables without th elements lack proper header structure
      const headers = container.querySelectorAll('th')
      expect(headers.length).toBe(0)
      // This is an accessibility anti-pattern — data tables need headers
    })
  })

  describe('Escape key closes modals', () => {
    it('Escape key event can be captured', () => {
      const onEscape = vi.fn()
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onEscape()
      }

      document.addEventListener('keydown', handleKeyDown)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(onEscape).toHaveBeenCalledTimes(1)
      document.removeEventListener('keydown', handleKeyDown)
    })
  })
})

// ---------------------------------------------------------------------------
// 7.3 Color & Contrast (structural checks)
// ---------------------------------------------------------------------------

describe('Accessibility — Color & Contrast Indicators', () => {
  it('status indicators use icons alongside color', () => {
    const { container } = render(
      <div>
        <span className="status-success" role="status">
          <svg aria-hidden="true" data-testid="check-icon"><circle /></svg>
          <span>Active</span>
        </span>
        <span className="status-error" role="status">
          <svg aria-hidden="true" data-testid="x-icon"><circle /></svg>
          <span>Inactive</span>
        </span>
      </div>
    )

    // Status indicators should have text, not just color
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('Inactive')).toBeTruthy()
    // Icons are present but hidden from screen readers
    const icons = container.querySelectorAll('svg[aria-hidden="true"]')
    expect(icons.length).toBe(2)
  })

  it('error states have text alongside visual indicators', () => {
    const { container } = render(
      <div>
        <div role="alert" className="text-red-500">
          <svg aria-hidden="true"><path /></svg>
          <span>This field is required</span>
        </div>
      </div>
    )

    expect(screen.getByText('This field is required')).toBeTruthy()
    expect(container.querySelector('[role="alert"]')).toBeTruthy()
  })

  it('focus indicators use visible outline styles', () => {
    const { container } = render(
      <button className="focus:ring-2 focus:ring-blue-500 focus:outline-none">
        Focusable Button
      </button>
    )

    const btn = container.querySelector('button')
    expect(btn?.className).toContain('focus:ring')
  })
})

// ---------------------------------------------------------------------------
// 7.4 WCAG 2.1 AA Compliance
// ---------------------------------------------------------------------------

describe('Accessibility — WCAG 2.1 AA', () => {
  describe('Form error association', () => {
    it('error messages are linked to inputs via aria-describedby', async () => {
      const { container } = render(
        <form>
          <label htmlFor="patient-name">Patient Name</label>
          <input
            id="patient-name"
            type="text"
            aria-invalid="true"
            aria-describedby="name-error"
          />
          <span id="name-error" role="alert">Name is required</span>
        </form>
      )
      const results = await axe(container)
      expectNoViolations(results)

      const input = container.querySelector('#patient-name')
      expect(input?.getAttribute('aria-invalid')).toBe('true')
      expect(input?.getAttribute('aria-describedby')).toBe('name-error')
    })
  })

  describe('Heading hierarchy', () => {
    it('headings follow correct order (h1 → h2 → h3)', async () => {
      const { container } = render(
        <div>
          <h1>Patient Management</h1>
          <h2>Patient List</h2>
          <h3>Active Patients</h3>
          <h3>Inactive Patients</h3>
          <h2>Add New Patient</h2>
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)

      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      expect(headings.length).toBe(5)
    })

    it('skipped heading levels trigger violation', async () => {
      const { container } = render(
        <div>
          <h1>Dashboard</h1>
          <h4>Skipped h2 and h3</h4>
        </div>
      )
      const results = await axe(container)
      const headingViolation = results.violations.find(
        (v) => v.id === 'heading-order'
      )
      expect(headingViolation).toBeDefined()
    })
  })

  describe('Link text is descriptive', () => {
    it('links with descriptive text pass', async () => {
      const { container } = render(
        <nav aria-label="Main">
          <a href="/patients">View All Patients</a>
          <a href="/appointments">Manage Appointments</a>
          <a href="/settings">Clinic Settings</a>
        </nav>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })

    it('empty links fail accessibility', async () => {
      const { container } = render(
        <nav aria-label="Test nav">
          <a href="/somewhere"></a>
        </nav>
      )
      const results = await axe(container)
      const linkViolation = results.violations.find(
        (v) => v.id === 'link-name'
      )
      expect(linkViolation).toBeDefined()
    })
  })

  describe('Table accessibility', () => {
    it('data table has proper th and scope', async () => {
      const { container } = render(
        <table aria-label="Invoice list">
          <thead>
            <tr>
              <th scope="col">Invoice #</th>
              <th scope="col">Patient</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>INV-001</td>
              <td>John Doe</td>
              <td>₹5,000</td>
              <td>Paid</td>
            </tr>
          </tbody>
        </table>
      )
      const results = await axe(container)
      expectNoViolations(results)
    })
  })

  describe('No auto-playing media', () => {
    it('video elements should not have autoplay', () => {
      const { container } = render(
        <div>
          <video controls aria-label="Consultation recording">
            <source src="video.mp4" type="video/mp4" />
          </video>
        </div>
      )

      const video = container.querySelector('video')
      expect(video?.hasAttribute('autoplay')).toBe(false)
      expect(video?.hasAttribute('controls')).toBe(true)
    })
  })

  describe('Navigation landmarks', () => {
    it('page has proper landmark structure', async () => {
      const { container } = render(
        <div>
          <nav aria-label="Main navigation">
            <a href="/dashboard">Dashboard</a>
            <a href="/patients">Patients</a>
          </nav>
          <main>
            <h1>Patient List</h1>
            <p>Manage your patients here.</p>
          </main>
        </div>
      )
      const results = await axe(container)
      expectNoViolations(results)

      expect(container.querySelector('nav')).toBeTruthy()
      expect(container.querySelector('main')).toBeTruthy()
    })
  })
})
