import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'

/**
 * Reports whether the server has an OpenRouter API key configured, so the AI
 * settings page can show a real "configured / missing" status instead of
 * "unknown". The key itself is never returned — only its presence.
 */
export async function GET() {
  const { error } = await requireAuthAndRole()
  if (error) return error

  return NextResponse.json({ configured: !!process.env.OPENROUTER_API_KEY })
}
