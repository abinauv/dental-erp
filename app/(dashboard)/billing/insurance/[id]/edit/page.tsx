'use client'

import { use } from 'react'
import { ClaimForm } from '@/components/insurance/claim-form'

export default function EditInsuranceClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ClaimForm claimId={id} />
}
