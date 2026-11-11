// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { LabOrderEditor } from '@/components/lab/lab-order-editor'

const order = {
  id: 'o1',
  orderNumber: 'LAB20260001',
  patientId: 'p1',
  patientCode: 'PAT001',
  firstName: 'Rahul',
  lastName: 'Sharma',
  patientPhone: '9876543301',
  labVendorId: 'v1',
  workType: 'CROWN',
  description: 'Zirconia crown',
  toothNumbers: '16',
  shadeGuide: 'A2',
  orderDate: '2026-11-01T00:00:00.000Z',
  expectedDate: '2026-11-10T00:00:00.000Z',
  estimatedCost: '1500',
  notes: null,
  // Not on the form; the update must send them back unchanged.
  sentDate: '2026-11-02T00:00:00.000Z',
  receivedDate: null,
  deliveredDate: null,
  actualCost: '1450',
  qualityCheck: 'PASSED',
  qualityNotes: 'Good fit',
  priority: 'URGENT',
  specialInstructions: 'Rush',
}

function mockApi() {
  global.fetch = vi.fn(async (url, init) => {
    if (url.startsWith('/api/patients')) return { ok: true, json: async () => ({ patients: [] }) }
    if (url.startsWith('/api/lab-vendors'))
      return { ok: true, json: async () => ({ data: [{ id: 'v1', name: 'Smile Lab' }] }) }
    if (url === '/api/lab-orders/o1' && !init?.method)
      return { ok: true, json: async () => ({ success: true, data: order }) }
    return { ok: true, json: async () => ({ success: true }) }
  })
}

describe('LabOrderEditor', () => {
  beforeEach(mockApi)

  it('loads an existing order into the form', async () => {
    render(<LabOrderEditor orderId="o1" />)

    expect(await screen.findByText('Rahul Sharma')).toBeInTheDocument()
    expect(screen.getByText('Edit Lab Order')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Zirconia crown')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-11-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument()
  })

  it('saves with PUT and keeps the fields the form does not show', async () => {
    render(<LabOrderEditor orderId="o1" />)
    await screen.findByText('Rahul Sharma')

    fireEvent.change(screen.getByDisplayValue('Zirconia crown'), {
      target: { value: 'Zirconia crown, polished' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/lab-orders/o1',
        expect.objectContaining({ method: 'PUT' })
      )
    )
    const put = global.fetch.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(put[1].body)).toEqual(
      expect.objectContaining({
        patientId: 'p1',
        labVendorId: 'v1',
        workType: 'CROWN',
        description: 'Zirconia crown, polished',
        orderDate: '2026-11-01',
        estimatedCost: 1500,
        sentDate: order.sentDate,
        actualCost: '1450',
        qualityCheck: 'PASSED',
        qualityNotes: 'Good fit',
        priority: 'URGENT',
        specialInstructions: 'Rush',
      })
    )
  })

  it('creates with POST when there is no order id', async () => {
    render(<LabOrderEditor />)
    expect(
      screen.getByText('Create Lab Order', { selector: 'button *, button' })
    ).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch).not.toHaveBeenCalledWith('/api/lab-orders/o1')
  })
})
