'use client'

import { use } from 'react'
import { InvoiceEditor } from '@/components/billing/invoice-editor'

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <InvoiceEditor invoiceId={id} />
}
