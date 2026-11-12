'use client'

import { use } from 'react'
import { TreatmentEditor } from '@/components/treatments/treatment-editor'

export default function EditTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <TreatmentEditor treatmentId={id} />
}
