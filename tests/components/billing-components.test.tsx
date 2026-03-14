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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children, onOpenChange }: any) =>
    open ? <div data-testid="dialog" data-open={open}>{children}</div> : null,
  DialogContent: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
}))

import { PaymentCheckout } from '@/components/billing/payment-checkout'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  invoiceId: 'inv-001',
  amount: 5000,
  invoiceNo: 'INV-2024-001',
  patientName: 'John Doe',
  onSuccess: vi.fn(),
  onClose: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentCheckout', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Trigger button', () => {
    it('renders default "Pay Online" button', () => {
      render(<PaymentCheckout {...defaultProps} />)
      expect(screen.getByText('Pay Online')).toBeInTheDocument()
    })

    it('renders custom trigger', () => {
      render(
        <PaymentCheckout
          {...defaultProps}
          trigger={<span>Custom Pay</span>}
        />
      )
      expect(screen.getByText('Custom Pay')).toBeInTheDocument()
    })

    it('opens dialog on click', () => {
      render(<PaymentCheckout {...defaultProps} />)
      fireEvent.click(screen.getByText('Pay Online'))
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })
  })

  describe('Dialog content (idle state)', () => {
    it('shows dialog title "Pay Online"', () => {
      render(<PaymentCheckout {...defaultProps} open={true} />)
      const matches = screen.getAllByText('Pay Online')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('shows invoice info in description', () => {
      render(<PaymentCheckout {...defaultProps} open={true} />)
      expect(screen.getByText(/INV-2024-001/)).toBeInTheDocument()
      expect(screen.getByText(/John Doe/)).toBeInTheDocument()
    })

    it('shows formatted amount', () => {
      render(<PaymentCheckout {...defaultProps} open={true} />)
      // Amount should be formatted as INR currency
      const amountTexts = screen.getAllByText(/5,000/)
      expect(amountTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('shows pay button with amount', () => {
      render(<PaymentCheckout {...defaultProps} open={true} />)
      const payBtns = screen.getAllByText(/Pay/)
      expect(payBtns.length).toBeGreaterThanOrEqual(1)
    })

    it('shows secure payment text', () => {
      render(<PaymentCheckout {...defaultProps} open={true} />)
      expect(screen.getByText(/Secured payment/)).toBeInTheDocument()
    })
  })

  describe('Payment flow', () => {
    it('calls create-order API when pay button is clicked', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkout: { provider: 'razorpay', key: 'rzp_test', amount: 500000, orderId: 'order_123' },
          order: { id: 'order_123' },
          hospital: { name: 'Test Clinic' },
          patient: { name: 'John', email: 'john@test.com', phone: '9999999999' },
        }),
      })

      // Mock Razorpay constructor
      const mockRazorpay = { open: vi.fn(), on: vi.fn() }
      ;(window as any).Razorpay = vi.fn(() => mockRazorpay)

      render(<PaymentCheckout {...defaultProps} open={true} />)

      // Find and click the "Pay ₹5,000" button (the main CTA)
      const payButtons = screen.getAllByText(/Pay/)
      const mainPayBtn = payButtons.find((btn) => btn.closest('button')?.textContent?.includes('5,000'))
      fireEvent.click(mainPayBtn || payButtons[payButtons.length - 1])

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/payments/create-order', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ invoiceId: 'inv-001', amount: 5000 }),
        }))
      })
    })

    it('shows loading state while creating order', async () => {
      fetchMock.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<PaymentCheckout {...defaultProps} open={true} />)
      const payButtons = screen.getAllByText(/Pay/)
      fireEvent.click(payButtons[payButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Preparing payment...')).toBeInTheDocument()
      })
    })

    it('shows error state when API fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Gateway not configured' }),
      })

      render(<PaymentCheckout {...defaultProps} open={true} />)
      const payButtons = screen.getAllByText(/Pay/)
      fireEvent.click(payButtons[payButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument()
        expect(screen.getByText('Gateway not configured')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      })

      render(<PaymentCheckout {...defaultProps} open={true} />)
      const payButtons = screen.getAllByText(/Pay/)
      fireEvent.click(payButtons[payButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      })
    })

    it('handles PhonePe redirect flow', async () => {
      const originalHref = window.location.href
      delete (window as any).location
      ;(window as any).location = { href: '' }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkout: { provider: 'phonepe', redirectUrl: 'https://phonepe.com/pay/123' },
          order: {},
          hospital: { name: 'Test' },
          patient: { name: 'Test' },
        }),
      })

      render(<PaymentCheckout {...defaultProps} open={true} />)
      const payButtons = screen.getAllByText(/Pay/)
      fireEvent.click(payButtons[payButtons.length - 1])

      await waitFor(() => {
        expect(window.location.href).toBe('https://phonepe.com/pay/123')
      })

      // Restore
      ;(window as any).location = { href: originalHref }
    })
  })

  describe('Controlled open state', () => {
    it('respects controlled open prop', () => {
      render(<PaymentCheckout {...defaultProps} open={true} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('does not render dialog when open is false', () => {
      render(<PaymentCheckout {...defaultProps} open={false} />)
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })
  })
})
