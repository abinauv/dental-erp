// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'

import { ClaimForm } from '@/components/insurance/claim-form'
import InsuranceClaimPage from '@/app/(dashboard)/billing/insurance/[id]/page'

const patient = {
  id: 'p1',
  patientId: 'PAT001',
  firstName: 'Rahul',
  lastName: 'Sharma',
  phone: '98765',
}

const invoice = (id, extra = {}) => ({
  id,
  invoiceNo: `INV-${id}`,
  createdAt: '2026-11-01T00:00:00.000Z',
  totalAmount: '1180',
  status: 'PENDING',
  insuranceClaimId: null,
  ...extra,
})

// Answers GETs by path prefix; other methods succeed with `{ id: 'new1' }`.
function mockApi(routes) {
  global.fetch = vi.fn(async (url, init) => {
    if (init?.method && init.method !== 'GET')
      return { ok: true, json: async () => ({ id: 'new1' }) }
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix))
    return { ok: true, json: async () => (key ? routes[key] : {}) }
  })
}
const sent = (method) => {
  const call = global.fetch.mock.calls.find(([, init]) => init?.method === method)
  return call && { url: call[0], body: init(call) }
}
const init = (call) => (call[1].body ? JSON.parse(call[1].body) : undefined)

describe('ClaimForm (new)', () => {
  it('links unclaimed invoices, totals them, and creates the claim', async () => {
    mockApi({
      '/api/patients?search': { patients: [patient] },
      '/api/patients/p1/insurance': [],
      '/api/invoices': {
        invoices: [
          invoice('a'),
          invoice('b', { totalAmount: '500' }),
          invoice('claimed', { insuranceClaimId: 'c9' }),
          invoice('draft', { status: 'DRAFT' }),
        ],
      },
    })
    render(<ClaimForm />)

    fireEvent.change(screen.getByPlaceholderText(/Search patients/), { target: { value: 'Ra' } })
    fireEvent.click(await screen.findByText('Rahul Sharma'))

    // Already-claimed and draft invoices aren't offered.
    expect(await screen.findByText('INV-a')).toBeInTheDocument()
    expect(screen.queryByText('INV-claimed')).not.toBeInTheDocument()
    expect(screen.queryByText('INV-draft')).not.toBeInTheDocument()
    expect(screen.getByText(/No insurance policies on file/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'INV-a' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'INV-b' }))
    expect(screen.getByLabelText('Claim amount')).toHaveValue(1680)

    fireEvent.change(screen.getByLabelText('Insurance provider'), {
      target: { value: 'Star Health' },
    })
    fireEvent.change(screen.getByLabelText('Policy number'), { target: { value: 'POL-1' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Claim/ }))

    await waitFor(() => expect(sent('POST')).toBeTruthy())
    expect(sent('POST').body).toEqual({
      patientId: 'p1',
      invoiceIds: ['a', 'b'],
      insuranceProvider: 'Star Health',
      policyNumber: 'POL-1',
      claimAmount: 1680,
      notes: '',
    })
  })

  it('asks for the insurer before saving', async () => {
    mockApi({ '/api/patients?search': { patients: [patient] }, '/api/invoices': { invoices: [] } })
    render(<ClaimForm />)
    fireEvent.change(screen.getByPlaceholderText(/Search patients/), { target: { value: 'Ra' } })
    fireEvent.click(await screen.findByText('Rahul Sharma'))
    fireEvent.click(await screen.findByRole('button', { name: /Create Claim/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the insurance provider.')
    expect(sent('POST')).toBeUndefined()
  })
})

describe('ClaimForm (edit)', () => {
  const draft = {
    id: 'c1',
    claimNumber: 'CLM-202611-0001',
    status: 'DRAFT',
    patient,
    insuranceProvider: 'Star Health',
    policyNumber: 'POL-1',
    claimAmount: '1180',
    notes: null,
    invoices: [invoice('a')],
  }

  it('edits the insurer, policy, amount and notes only', async () => {
    mockApi({ '/api/insurance-claims/c1': draft, '/api/patients/p1/insurance': [] })
    render(<ClaimForm claimId="c1" />)

    expect(await screen.findByText('Edit Claim CLM-202611-0001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Claim amount'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(sent('PUT')).toBeTruthy())
    expect(sent('PUT').url).toBe('/api/insurance-claims/c1')
    expect(sent('PUT').body).toEqual({
      insuranceProvider: 'Star Health',
      policyNumber: 'POL-1',
      claimAmount: 1000,
      notes: '',
    })
  })

  it('refuses a submitted claim', async () => {
    mockApi({ '/api/insurance-claims/c1': { ...draft, status: 'SUBMITTED' } })
    render(<ClaimForm claimId="c1" />)
    expect(await screen.findByText(/has been submitted/)).toBeInTheDocument()
  })
})

describe('/billing/insurance/[id]', () => {
  const claim = (status, extra = {}) => ({
    id: 'c1',
    claimNumber: 'CLM-202611-0001',
    status,
    insuranceProvider: 'Star Health',
    policyNumber: 'POL-1',
    claimAmount: '1180',
    approvedAmount: null,
    settledAmount: null,
    submittedDate: '2026-11-02T00:00:00.000Z',
    approvedDate: null,
    settledDate: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    rejectionReason: null,
    denialCode: null,
    appealStatus: null,
    appealDeadline: null,
    appealNotes: null,
    notes: null,
    patient,
    invoices: [invoice('a')],
    ...extra,
  })

  async function renderClaim(data) {
    mockApi({ '/api/insurance-claims/c1': data })
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <InsuranceClaimPage params={Promise.resolve({ id: 'c1' })} />
        </Suspense>
      )
    })
    await screen.findByText('CLM-202611-0001')
  }

  it('offers edit, delete and submit on a draft, and submits', async () => {
    await renderClaim(claim('DRAFT'))
    expect(screen.getByRole('link', { name: /Edit/ })).toHaveAttribute(
      'href',
      '/billing/insurance/c1/edit'
    )
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Submit Claim/ }))
    await waitFor(() => expect(sent('PUT')?.body).toEqual({ status: 'SUBMITTED' }))
  })

  it('records a full approval by default', async () => {
    await renderClaim(claim('SUBMITTED'))
    expect(screen.getByRole('button', { name: /Mark Under Review/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Record Decision/ }))

    // Approve in full by default: the amount starts at the claimed amount.
    expect(await screen.findByLabelText('Approved amount')).toHaveValue(1180)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sent('PUT')?.body).toEqual({ status: 'APPROVED', approvedAmount: 1180 })
    )
  })

  it('records a rejection only with a reason', async () => {
    // Radix Select needs these in jsdom.
    Element.prototype.hasPointerCapture ??= () => false
    Element.prototype.scrollIntoView ??= () => {}
    await renderClaim(claim('UNDER_REVIEW'))
    fireEvent.click(screen.getByRole('button', { name: /Record Decision/ }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Decision' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Rejected' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the reason')
    expect(sent('PUT')).toBeUndefined()

    fireEvent.change(screen.getByLabelText('Rejection reason'), {
      target: { value: 'Not covered' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sent('PUT')?.body).toEqual({ status: 'REJECTED', rejectionReason: 'Not covered' })
    )
  })

  it('records the settlement of an approved claim', async () => {
    await renderClaim(claim('APPROVED', { approvedAmount: '1000' }))
    fireEvent.click(screen.getByRole('button', { name: /Record Settlement/ }))
    expect(await screen.findByLabelText('Amount received')).toHaveValue(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sent('PUT')?.body).toEqual({ status: 'SETTLED', settledAmount: 1000 })
    )
  })

  it('shows no actions once settled', async () => {
    await renderClaim(claim('SETTLED', { approvedAmount: '1000', settledAmount: '1000' }))
    expect(screen.queryByRole('button', { name: /Record/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit/ })).not.toBeInTheDocument()
  })
})
