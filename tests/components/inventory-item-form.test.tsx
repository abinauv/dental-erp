// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { InventoryItemForm, emptyInventoryItem } from '@/components/inventory/item-form'

const item = {
  ...emptyInventoryItem,
  sku: 'ITM001',
  name: 'Composite Resin A2',
  unit: 'syringe',
  currentStock: 35,
  minimumStock: 10,
}

describe('InventoryItemForm', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: true, data: [] }) })
  })

  it('adds an item with every field editable', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <InventoryItemForm
        mode="create"
        initialValues={emptyInventoryItem}
        saving={false}
        cancelHref="/inventory"
        onSubmit={onSubmit}
      />
    )
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))

    expect(container.querySelector('input[name="currentStock"]')).not.toBeDisabled()
    fireEvent.change(container.querySelector('input[name="sku"]'), { target: { value: 'NEW1' } })
    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Gauze' } })
    fireEvent.change(container.querySelector('input[name="unit"]'), { target: { value: 'pack' } })
    fireEvent.change(container.querySelector('input[name="currentStock"]'), {
      target: { value: '12' },
    })
    fireEvent.submit(container.querySelector('form'))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'NEW1', name: 'Gauze', unit: 'pack', currentStock: 12 })
    )
    expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument()
  })

  it('edits an item with its values, but not its stock', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <InventoryItemForm
        mode="edit"
        initialValues={item}
        saving={false}
        cancelHref="/inventory/i1"
        onSubmit={onSubmit}
      />
    )

    expect(container.querySelector('input[name="name"]')).toHaveValue('Composite Resin A2')
    expect(container.querySelector('input[name="currentStock"]')).toBeDisabled()
    expect(screen.getByText('Stock changes through stock transactions.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/inventory/i1')

    fireEvent.change(container.querySelector('input[name="minimumStock"]'), {
      target: { value: '15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'ITM001', minimumStock: 15, currentStock: 35 })
    )
  })

  it('shows that it is saving', () => {
    render(
      <InventoryItemForm
        mode="edit"
        initialValues={item}
        saving
        cancelHref="/inventory/i1"
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
