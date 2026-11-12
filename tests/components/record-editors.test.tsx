// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Heavy children that aren't under test here.
vi.mock('@/components/treatments/dental-chart', () => ({
  DentalChart: ({ selectedTeeth }) => <div data-testid="chart">{selectedTeeth.join(',')}</div>,
}))
vi.mock('@/components/ai/treatment-assist', () => ({ TreatmentAssist: () => null }))
vi.mock('@/components/clinical/voice-input', () => ({ VoiceInput: () => null }))

import { InvoiceEditor } from '@/components/billing/invoice-editor'
import { TreatmentEditor } from '@/components/treatments/treatment-editor'
import { TreatmentPlanEditor } from '@/components/treatments/treatment-plan-editor'

const patient = {
  id: 'p1',
  patientId: 'PAT001',
  firstName: 'Rahul',
  lastName: 'Sharma',
  phone: '9876543301',
  email: null,
}

// Answers GETs by path; anything else (the save) succeeds.
// The lists the forms load alongside the record.
const lists = {
  '/api/patients': { patients: [] },
  '/api/staff/doctors': { doctors: [] },
  '/api/procedures': { procedures: [] },
  '/api/billing/unbilled-treatments': { treatments: [] },
}

function mockApi(records: Record<string, unknown>) {
  const routes = { ...lists, ...records }
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') return { ok: true, json: async () => ({ id: 'x' }) }
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix))
    if (key) return { ok: true, json: async () => routes[key] }
    return { ok: true, json: async () => ({}) }
  })
}

const sent = (method: string) => {
  const call = global.fetch.mock.calls.find(([, init]) => init?.method === method)
  return call && { url: call[0], body: JSON.parse(call[1].body) }
}

describe('InvoiceEditor (edit)', () => {
  const draft = {
    id: 'inv1',
    invoiceNo: 'INV-0007',
    status: 'DRAFT',
    patient,
    createdAt: '2026-11-01T00:00:00.000Z',
    dueDate: '2026-11-16T00:00:00.000Z',
    discountType: 'PERCENTAGE',
    discountValue: '5',
    notes: 'Pay at reception',
    termsAndConditions: 'Net 15',
    items: [
      {
        id: 'it1',
        treatmentId: 't1',
        description: 'Scaling',
        quantity: 1,
        unitPrice: '1200',
        taxable: true,
      },
    ],
  }

  it('loads a draft, keeps its patient, and saves it with PUT', async () => {
    mockApi({ '/api/invoices/inv1': draft })
    render(<InvoiceEditor invoiceId="inv1" />)

    expect(await screen.findByText('Edit Invoice INV-0007')).toBeInTheDocument()
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Scaling')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(sent('PUT')).toBeTruthy())

    const { url, body } = sent('PUT')
    expect(url).toBe('/api/invoices/inv1')
    expect(body).toEqual(
      expect.objectContaining({
        status: 'DRAFT',
        discountType: 'PERCENTAGE',
        discountValue: 5,
        notes: 'Pay at reception',
        termsAndConditions: 'Net 15',
        items: [
          {
            treatmentId: 't1',
            description: 'Scaling',
            quantity: 1,
            unitPrice: 1200,
            taxable: true,
          },
        ],
      })
    )
    // The terms weren't touched, so the due date stays as it is.
    expect(body).not.toHaveProperty('dueDate')
  })

  it('finalizes with PENDING', async () => {
    mockApi({ '/api/invoices/inv1': draft })
    render(<InvoiceEditor invoiceId="inv1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Finalize' }))
    await waitFor(() => expect(sent('PUT')?.body.status).toBe('PENDING'))
  })

  it('refuses an invoice that is no longer a draft', async () => {
    mockApi({ '/api/invoices/inv1': { ...draft, status: 'PENDING' } })
    render(<InvoiceEditor invoiceId="inv1" />)
    expect(await screen.findByText(/isn't a draft any more/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Invoice' })).toHaveAttribute(
      'href',
      '/billing/invoices/inv1'
    )
  })
})

describe('TreatmentEditor (edit)', () => {
  const treatment = {
    id: 't1',
    treatmentNo: 'TRT0001',
    status: 'PLANNED',
    patientId: 'p1',
    doctorId: 'd1',
    procedureId: 'pr1',
    appointmentId: null,
    patient,
    procedure: { id: 'pr1', code: 'SC', name: 'Scaling', category: 'PREVENTIVE', basePrice: 1200 },
    toothNumbers: '16,17',
    chiefComplaint: 'Bleeding gums',
    diagnosis: '',
    findings: null,
    procedureNotes: null,
    materialsUsed: null,
    followUpRequired: false,
    followUpDate: null,
    cost: '1200',
  }

  it('loads the treatment and saves only the fields the API updates', async () => {
    mockApi({ '/api/treatments/t1': treatment })
    render(<TreatmentEditor treatmentId="t1" />)

    expect(await screen.findByText('Edit Treatment TRT0001')).toBeInTheDocument()
    expect(screen.getByTestId('chart')).toHaveTextContent('16,17')
    fireEvent.change(screen.getByDisplayValue('Bleeding gums'), {
      target: { value: 'Bleeding gums, lower left' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(sent('PUT')).toBeTruthy())
    const { url, body } = sent('PUT')
    expect(url).toBe('/api/treatments/t1')
    expect(body).toEqual(
      expect.objectContaining({
        toothNumbers: '16,17',
        chiefComplaint: 'Bleeding gums, lower left',
        cost: 1200,
        followUpRequired: false,
        followUpDate: null,
      })
    )
    // The update can't move a treatment to another patient, doctor or procedure.
    expect(body).not.toHaveProperty('patientId')
    expect(body).not.toHaveProperty('doctorId')
    expect(body).not.toHaveProperty('procedureId')
  })

  it('refuses a completed treatment', async () => {
    mockApi({ '/api/treatments/t1': { ...treatment, status: 'COMPLETED' } })
    render(<TreatmentEditor treatmentId="t1" />)
    expect(await screen.findByText(/completed or cancelled/)).toBeInTheDocument()
  })
})

describe('TreatmentPlanEditor (edit)', () => {
  const plan = {
    id: 'pl1',
    status: 'IN_PROGRESS',
    title: 'Full mouth rehab',
    notes: null,
    startDate: '2026-11-01T00:00:00.000Z',
    expectedEndDate: null,
    patient,
    items: [
      {
        procedureId: 'pr1',
        procedure: { name: 'Scaling', code: 'SC', category: 'PREVENTIVE' },
        toothNumbers: null,
        estimatedCost: '1200',
        notes: null,
        status: 'COMPLETED',
      },
      {
        procedureId: 'pr2',
        procedure: { name: 'Filling', code: 'FL', category: 'RESTORATIVE' },
        toothNumbers: '36',
        estimatedCost: '2500',
        notes: 'Composite',
        status: 'PENDING',
      },
    ],
  }

  it('keeps started items and sends every item back with its status', async () => {
    mockApi({ '/api/treatment-plans/pl1': plan })
    render(<TreatmentPlanEditor planId="pl1" />)

    expect(await screen.findByDisplayValue('Full mouth rehab')).toBeInTheDocument()
    // The completed item shows its status instead of a remove button.
    expect(screen.getByText('Completed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }))
    await waitFor(() => expect(sent('PUT')).toBeTruthy())

    const { url, body } = sent('PUT')
    expect(url).toBe('/api/treatment-plans/pl1')
    expect(body.title).toBe('Full mouth rehab')
    expect(body.startDate).toBe('2026-11-01')
    expect(body.items).toEqual([
      expect.objectContaining({
        procedureId: 'pr1',
        priority: 1,
        status: 'COMPLETED',
        estimatedCost: 1200,
      }),
      expect.objectContaining({
        procedureId: 'pr2',
        priority: 2,
        status: 'PENDING',
        toothNumbers: '36',
      }),
    ])
  })

  it('refuses a cancelled plan', async () => {
    mockApi({ '/api/treatment-plans/pl1': { ...plan, status: 'CANCELLED' } })
    render(<TreatmentPlanEditor planId="pl1" />)
    expect(await screen.findByText(/completed or cancelled/)).toBeInTheDocument()
  })
})
