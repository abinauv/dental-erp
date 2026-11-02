/**
 * Anthropic-direct provider — Claude via the official Anthropic SDK.
 * Enabled with `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClaudeProvider } from './claude-common'

let client: Anthropic | undefined

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set (AI_PROVIDER=anthropic).')
    }
    client = new Anthropic()
  }
  return client
}

export const anthropicProvider = createClaudeProvider(getClient, '')
