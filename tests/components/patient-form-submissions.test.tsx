// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span data-testid="badge" className={className}>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children, onOpenChange }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange, value }) : child
      )}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange }) : child
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)} role="option">
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef((props: any, ref: any) => <textarea ref={ref} {...props} />),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/forms/form-renderer', () => ({
  FormRenderer: ({ readOnly, initialData }: any) => (
    <div data-testid="form-renderer" data-readonly={readOnly}>
      Form Renderer (readOnly: {String(readOnly)})
    </div>
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

import { PatientFormSubmissions } from '@/components/forms/patient-form-submissions'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockSubmissions = [
  {
    id: 'sub-1',
    templateId: 'tpl-1',
    patientId: 'p-1',
    appointmentId: null,
    data: { name: 'John Doe' },
    signature: 'data:image/png;base64,abc',
    signedAt: '2025-01-15T10:00:00Z',
    status: 'SUBMITTED',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: '2025-01-15T10:00:00Z',
    template: { id: 'tpl-1', name: 'Consent Form', type: 'CONSENT' },
  },
  {
    id: 'sub-2',
    templateId: 'tpl-2',
    patientId: 'p-1',
    appointmentId: null,
    data: { symptoms: 'Pain' },
    signature: null,
    signedAt: null,
    status: 'APPROVED',
    reviewedBy: 'doc-1',
    reviewedAt: '2025-01-16T12:00:00Z',
    reviewNotes: 'Looks good',
    createdAt: '2025-01-14T09:00:00Z',
    template: { id: 'tpl-2', name: 'Medical History', type: 'MEDICAL' },
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientFormSubmissions', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows title "Form Submissions"', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: [] }),
    })
    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Form Submissions')).toBeInTheDocument()
    })
  })

  it('shows empty state when no submissions', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: [] }),
    })
    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('No form submissions for this patient')).toBeInTheDocument()
    })
  })

  it('fetches submissions for patientId', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: [] }),
    })
    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/forms?patientId=p-1')
    })
  })

  it('renders submission list with template names', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: mockSubmissions }),
    })
    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Consent Form')).toBeInTheDocument()
      expect(screen.getByText('Medical History')).toBeInTheDocument()
    })
  })

  it('shows status badges for submissions', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: mockSubmissions }),
    })
    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Pending Review')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  it('shows (Signed) indicator for signed submissions', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: mockSubmissions }),
    })
    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText(/\(Signed\)/)).toBeInTheDocument()
    })
  })

  it('opens view dialog when submission clicked', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ submissions: mockSubmissions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submission: {
            ...mockSubmissions[0],
            template: { ...mockSubmissions[0].template, fields: [{ id: 'name', type: 'text', label: 'Name' }] },
          },
        }),
      })

    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Consent Form')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Consent Form'))

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('form-renderer')).toBeInTheDocument()
    })
  })

  it('shows review section in dialog', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ submissions: mockSubmissions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submission: {
            ...mockSubmissions[0],
            template: { ...mockSubmissions[0].template, fields: [] },
          },
        }),
      })

    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Consent Form')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Consent Form'))

    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument()
      expect(screen.getByText('Save Review')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  it('shows review status options', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ submissions: mockSubmissions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submission: {
            ...mockSubmissions[0],
            template: { ...mockSubmissions[0].template, fields: [] },
          },
        }),
      })

    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => screen.getByText('Consent Form'))
    fireEvent.click(screen.getByText('Consent Form'))

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Reviewed')).toBeInTheDocument()
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })
  })

  it('shows review notes textarea', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ submissions: mockSubmissions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submission: {
            ...mockSubmissions[0],
            template: { ...mockSubmissions[0].template, fields: [] },
          },
        }),
      })

    render(<PatientFormSubmissions patientId="p-1" />)
    await waitFor(() => screen.getByText('Consent Form'))
    fireEvent.click(screen.getByText('Consent Form'))

    await waitFor(() => {
      expect(screen.getByText('Review Notes')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Optional notes...')).toBeInTheDocument()
    })
  })
})
