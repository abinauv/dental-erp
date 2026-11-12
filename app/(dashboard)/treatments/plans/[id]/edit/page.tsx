'use client'

import { use } from 'react'
import { TreatmentPlanEditor } from '@/components/treatments/treatment-plan-editor'

export default function EditTreatmentPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <TreatmentPlanEditor planId={id} />
}
