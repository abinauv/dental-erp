// @ts-nocheck
// Invoices show the date they were created (they have no separate
// "invoiceDate"; reading one showed "-" on the list and the invoice page).
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React, { Suspense } from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/billing/invoices',
}))

import InvoicesPage from '@/app/(dashboard)/billing/invoices/page'
import InvoiceDetailPage from '@/app/(dashboard)/billing/invoices/[id]/page'

const invoice = {
  id: 'i1',
  invoiceNo: 'INV-202611-0042',
  createdAt: '2026-11-02T10:00:00.000Z',
  dueDate: '2026-11-17T00:00:00.000Z',
  subtotal: '1000',
  discountType: 'FIXED',
  discountValue: '0',
  discountAmount: '0',
  taxableAmount: '1000',
  cgstRate: '9',
  cgstAmount: '90',
  sgstRate: '9',
  sgstAmount: '90',
  totalAmount: '1180',
  paidAmount: '0',
  balanceAmount: '1180',
  status: 'PENDING',
  notes: null,
  patient: { id: 'p1', patientId: 'PAT1', firstName: 'Asha', lastName: 'Rao', phone: '98765' },
  items: [],
  payments: [],
}

function api(body) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => body }))
}

describe('invoice dates', () => {
  it('the invoice page shows when it was created', async () => {
    api(invoice)
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <InvoiceDetailPage params={Promise.resolve({ id: 'i1' })} />
        </Suspense>
      )
    })
    expect(await screen.findByText('Created on 02 Nov 2026')).toBeInTheDocument()
    expect(screen.getByText('Invoice Date').nextSibling).toHaveTextContent('02 Nov 2026')
  })

  it('the invoice list shows each invoice’s date', async () => {
    api({ invoices: [invoice], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })
    await act(async () => {
      render(<InvoicesPage />)
    })
    expect(await screen.findByText('INV-202611-0042')).toBeInTheDocument()
    expect(screen.getByText('02 Nov 2026')).toBeInTheDocument()
  })
})
