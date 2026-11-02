/**
 * Amazon Bedrock provider — Claude via the official Bedrock SDK (Mantle client).
 * Enabled with `AI_PROVIDER=bedrock` and AWS credentials + region. The operator
 * must have Bedrock access to the Claude models in lib/ai/models (resolveClaudeModel).
 */

import type Anthropic from '@anthropic-ai/sdk'
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import { createClaudeProvider } from './claude-common'

let client: AnthropicBedrockMantle | undefined

function getClient(): AnthropicBedrockMantle {
  if (!client) {
    const region = process.env.AWS_REGION || process.env.BEDROCK_AWS_REGION
    if (!region) {
      throw new Error(
        'AWS_REGION (or BEDROCK_AWS_REGION) is not set (AI_PROVIDER=bedrock). AWS credentials come from the standard provider chain.'
      )
    }
    client = new AnthropicBedrockMantle({ awsRegion: region })
  }
  return client
}

// The Mantle client exposes the same messages surface as the base SDK client.
export const bedrockProvider = createClaudeProvider(
  () => getClient() as unknown as Anthropic,
  'anthropic.'
)
