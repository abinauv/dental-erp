// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { RefundDialog } from '@/components/billing/refund-dialog'

const payment = { id: 'pay1', paymentNo: 'PAY-0001', amount: '500.25' }

describe('RefundDialog', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  it('renders nothing without a payment', () => {
    render(<RefundDialog payment={null} onOpenChange={vi.fn()} onRefunded={vi.fn()} />)
    expect(screen.queryByText('Refund payment')).not.toBeInTheDocument()
  })

  it('starts from the whole payment amount', () => {
    render(<RefundDialog payment={payment} onOpenChange={vi.fn()} onRefunded={vi.fn()} />)
    expect(screen.getByText('Refund payment')).toBeInTheDocument()
    expect(screen.getByText(/PAY-0001/)).toBeInTheDocument()
    expect(screen.getByLabelText('Refund amount')).toHaveValue(500.25)
  })

  it('posts the amount and reason, then closes and reloads', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    const onOpenChange = vi.fn()
    const onRefunded = vi.fn()
    render(<RefundDialog payment={payment} onOpenChange={onOpenChange} onRefunded={onRefunded} />)

    fireEvent.change(screen.getByLabelText('Refund amount'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: ' Duplicate charge ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))

    await waitFor(() => expect(onRefunded).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payments/pay1/refund',
      expect.objectContaining({ method: 'POST' })
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refundAmount: 200,
      refundReason: 'Duplicate charge',
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('refuses more than the payment without calling the API', async () => {
    render(<RefundDialog payment={payment} onOpenChange={vi.fn()} onRefunded={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Refund amount'), { target: { value: '600' } })
    fireEvent.submit(screen.getByLabelText('Refund amount').closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/up to/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the API's error and stays open", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Payment has already been refunded' }),
    })
    const onOpenChange = vi.fn()
    render(<RefundDialog payment={payment} onOpenChange={onOpenChange} onRefunded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Payment has already been refunded')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
