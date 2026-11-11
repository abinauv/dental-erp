'use client'

import { use } from 'react'
import { LabOrderEditor } from '@/components/lab/lab-order-editor'

export default function EditLabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <LabOrderEditor orderId={id} />
}
