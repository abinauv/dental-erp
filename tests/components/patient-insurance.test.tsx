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
  Card: ({ children, className }: any) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span data-testid="badge" className={className}>{children}</span>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
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

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/billing-utils', () => ({
  formatCurrency: (n: number) => `₹${n.toLocaleString('en-IN')}`,
  formatDate: (d: string) => new Date(d).toLocaleDateString('en-IN'),
}))

import { PatientInsurance } from '@/components/insurance/patient-insurance'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPolicy = {
  id: 'pol-1',
  policyNumber: 'POL-12345',
  groupNumber: 'GRP-001',
  memberId: 'MEM-001',
  subscriberName: 'John Doe',
  subscriberRelation: 'Self',
  effectiveDate: '2025-01-01',
  expiryDate: '2026-01-01',
  coverageType: 'Individual',
  annualMaximum: 500000,
  usedAmount: 50000,
  remainingAmount: 450000,
  deductible: 5000,
  deductibleMet: true,
  copayPercentage: 20,
  isActive: true,
  lastVerifiedAt: '2025-06-01',
  verificationStatus: 'VERIFIED',
  provider: { id: 'prov-1', name: 'Star Health', code: 'SH', contactPhone: '1800123456' },
}

const mockProviders = [
  { id: 'prov-1', name: 'Star Health' },
  { id: 'prov-2', name: 'ICICI Lombard' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientInsurance', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading skeletons initially', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    render(<PatientInsurance patientId="p-1" />)
    expect(screen.getAllByTestId('skeleton').length).toBe(3)
  })

  it('renders title "Insurance Policies"', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Insurance Policies')).toBeInTheDocument()
    })
  })

  it('renders "Add Policy" button', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Add Policy')).toBeInTheDocument()
    })
  })

  it('shows empty state when no policies', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('No insurance policies on file')).toBeInTheDocument()
    })
  })

  it('renders policy card with provider name', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Star Health')).toBeInTheDocument()
    })
  })

  it('shows policy number', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText(/POL-12345/)).toBeInTheDocument()
    })
  })

  it('shows group number', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText(/GRP-001/)).toBeInTheDocument()
    })
  })

  it('shows member ID', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('MEM-001')).toBeInTheDocument()
    })
  })

  it('shows subscriber name and relation', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('John Doe (Self)')).toBeInTheDocument()
    })
  })

  it('shows Verified badge', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })
  })

  it('shows Unverified badge when no verification status', async () => {
    const unverified = { ...mockPolicy, verificationStatus: null }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [unverified] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Unverified')).toBeInTheDocument()
    })
  })

  it('shows Expired badge', async () => {
    const expired = { ...mockPolicy, verificationStatus: 'EXPIRED' }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [expired] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  it('shows copay percentage', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
  })

  it('shows deductible met indicator', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('(Met)')).toBeInTheDocument()
    })
  })

  it('shows Verify button', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Verify')).toBeInTheDocument()
    })
  })

  it('shows Deactivate button for active policy', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Deactivate')).toBeInTheDocument()
    })
  })

  it('shows Activate button for inactive policy', async () => {
    const inactive = { ...mockPolicy, isActive: false }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [inactive] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Activate')).toBeInTheDocument()
    })
  })

  it('shows Inactive badge for inactive policy', async () => {
    const inactive = { ...mockPolicy, isActive: false }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [inactive] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('opens Add Policy dialog', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => {
      expect(screen.getByText('Add Policy')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Add Policy'))
    expect(screen.getByText('Add Insurance Policy')).toBeInTheDocument()
  })

  it('dialog has required form fields', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => screen.getByText('Add Policy'))
    fireEvent.click(screen.getByText('Add Policy'))

    expect(screen.getByText('Insurance Provider *')).toBeInTheDocument()
    expect(screen.getByText('Policy Number *')).toBeInTheDocument()
    expect(screen.getByText('Member ID *')).toBeInTheDocument()
    expect(screen.getByText('Subscriber Name *')).toBeInTheDocument()
    expect(screen.getByText('Effective Date *')).toBeInTheDocument()
  })

  it('shows validation toast when saving without required fields', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => screen.getByText('Add Policy'))
    fireEvent.click(screen.getByText('Add Policy'))

    // Click the submit button (Add Policy inside dialog)
    const buttons = screen.getAllByText('Add Policy')
    fireEvent.click(buttons[buttons.length - 1])

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Please fill all required fields' })
    )
  })

  it('calls verify API when Verify clicked', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
      // verify call
      .mockResolvedValueOnce({ ok: true })
      // re-fetch
      .mockResolvedValueOnce({ ok: true, json: async () => [mockPolicy] })

    render(<PatientInsurance patientId="p-1" />)
    await waitFor(() => screen.getByText('Verify'))
    fireEvent.click(screen.getByText('Verify'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/patients/p-1/insurance/verify',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
