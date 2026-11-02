import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { getProviderName } from '@/lib/ai/provider'

/**
 * Reports whether the server has credentials configured for the active AI
 * provider, so the AI settings page can show a real "configured / missing"
 * status instead of "unknown". Secrets are never returned — only presence.
 */
export async function GET() {
  const { error } = await requireAuthAndRole()
  if (error) return error

  const provider = getProviderName()
  const configured =
    provider === 'anthropic'
      ? !!process.env.ANTHROPIC_API_KEY
      : provider === 'bedrock'
        ? !!(process.env.AWS_REGION || process.env.BEDROCK_AWS_REGION)
        : !!process.env.OPENROUTER_API_KEY

  return NextResponse.json({ provider, configured })
}
