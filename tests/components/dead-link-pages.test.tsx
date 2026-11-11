// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React, { Suspense } from 'react'

import InventoryItemPage from '@/app/(dashboard)/inventory/[id]/page'
import LabOrderPage from '@/app/(dashboard)/lab/orders/[id]/page'

// Pages that list menus used to link to without the pages existing.

// The pages read their id with use(params), which suspends first.
async function renderPage(Page, id) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <Page params={Promise.resolve({ id })} />
      </Suspense>
    )
  })
}

function respond(body, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({ ok, json: async () => body })
}

describe('/inventory/[id]', () => {
  const item = {
    id: 'i1',
    sku: 'ITM002',
    name: 'Disposable Gloves (M)',
    itemType: 'CONSUMABLE',
    unit: 'box',
    currentStock: 6,
    minimumStock: 10,
    reorderLevel: 15,
    maximumStock: null,
    purchasePrice: '320',
    sellingPrice: '0',
    taxPercentage: '12',
    hsnCode: null,
    storageLocation: 'Store A',
    expiryTracking: false,
    batchTracking: false,
    isActive: true,
    categoryName: 'Consumables',
    supplierName: 'Chennai Dental Depot',
    supplierPhone: '044-1234',
    supplierEmail: null,
    stockStatus: 'low_stock',
    purchasesLast30Days: 20,
    usageLast30Days: 14,
    description: null,
    notes: null,
    batches: [],
    recentTransactions: [
      {
        id: 't1',
        type: 'CONSUMPTION',
        quantity: 14,
        newStock: 6,
        transactionDate: '2026-10-21T00:00:00.000Z',
        supplierName: null,
        performedByName: 'Admin',
      },
    ],
  }

  it('shows the item, its stock status and recent transactions', async () => {
    respond({ success: true, data: item })
    await renderPage(InventoryItemPage, 'i1')

    expect(await screen.findByText('Disposable Gloves (M)')).toBeInTheDocument()
    expect(screen.getByText('Low Stock')).toBeInTheDocument()
    expect(screen.getByText('Chennai Dental Depot')).toBeInTheDocument()
    expect(screen.getByText('Consumption')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Edit/ })).toHaveAttribute('href', '/inventory/i1/edit')
    expect(global.fetch).toHaveBeenCalledWith('/api/inventory/items/i1')
  })

  it('says when the item does not exist', async () => {
    respond({ error: 'Inventory item not found' }, false)
    await renderPage(InventoryItemPage, 'missing')
    expect(await screen.findByText(/doesn't exist/)).toBeInTheDocument()
  })
})

describe('/lab/orders/[id]', () => {
  const order = {
    id: 'o1',
    orderNumber: 'LAB20260001',
    status: 'SENT_TO_LAB',
    priority: 'URGENT',
    workType: 'CROWN',
    description: 'Zirconia crown',
    toothNumbers: '16',
    shadeGuide: 'A2',
    orderDate: '2026-11-01T00:00:00.000Z',
    expectedDate: null,
    sentDate: '2026-11-02T00:00:00.000Z',
    receivedDate: null,
    deliveredDate: null,
    estimatedCost: '1500',
    actualCost: null,
    qualityCheck: 'PENDING',
    qualityNotes: null,
    notes: null,
    specialInstructions: null,
    patientId: 'p1',
    patientCode: 'PAT001',
    patientName: 'Rahul Sharma',
    patientPhone: '9876543301',
    vendorName: 'Smile Lab',
    vendorPhone: null,
    vendorEmail: null,
    createdByName: 'Admin',
    history: [
      {
        id: 'h1',
        statusFrom: 'CREATED',
        statusTo: 'SENT_TO_LAB',
        notes: null,
        createdAt: '2026-11-02T00:00:00.000Z',
        changedByName: 'Admin',
      },
    ],
    documents: [],
  }

  it('shows the order, its status history and an edit link', async () => {
    respond({ success: true, data: order })
    await renderPage(LabOrderPage, 'o1')

    expect(await screen.findByText('LAB20260001')).toBeInTheDocument()
    expect(screen.getByText('Rahul Sharma (PAT001)')).toHaveAttribute('href', '/patients/p1')
    expect(screen.getByText('Smile Lab')).toBeInTheDocument()
    expect(screen.getByText('Created → Sent to Lab')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Edit/ })).toHaveAttribute(
      'href',
      '/lab/orders/o1/edit'
    )
    // Nothing to send until a different status is chosen.
    expect(screen.getByRole('button', { name: 'Update Status' })).toBeDisabled()
  })

  it('says when the order does not exist', async () => {
    respond({ error: 'Lab order not found' }, false)
    await renderPage(LabOrderPage, 'missing')
    expect(await screen.findByText(/doesn't exist/)).toBeInTheDocument()
  })
})
