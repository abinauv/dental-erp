/**
 * AI provider abstraction.
 *
 * The AI layer is pluggable. `AI_PROVIDER` selects the backend at runtime:
 *   - `openrouter` (default) — OpenAI-compatible HTTP, the zero-config default;
 *     keeps working with just OPENROUTER_API_KEY.
 *   - `anthropic` — Claude via the official Anthropic SDK (ANTHROPIC_API_KEY).
 *   - `bedrock` — Claude via Amazon Bedrock (AWS credentials + region).
 *
 * Callers use `complete` / `streamResponse` / `extractJSON` and never touch a
 * provider directly. Providers are imported lazily so a deployment only loads
 * the SDK for the backend it actually uses.
 */

import type { ModelConfig } from './models'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CompletionResponse {
  content: string
  usage: CompletionUsage
  model: string
}

export interface AIProvider {
  complete(messages: ChatMessage[], config?: Partial<ModelConfig>): Promise<CompletionResponse>
  streamResponse(messages: ChatMessage[], config?: Partial<ModelConfig>): Promise<Response>
}

export type ProviderName = 'openrouter' | 'anthropic' | 'bedrock'

/** The configured provider, defaulting to OpenRouter. */
export function getProviderName(): ProviderName {
  const p = (process.env.AI_PROVIDER || 'openrouter').toLowerCase()
  return p === 'anthropic' || p === 'bedrock' ? p : 'openrouter'
}

let cached: AIProvider | undefined
let cachedName: ProviderName | undefined

/** Resolve the active provider (lazily imported, then cached per name). */
export async function getAIProvider(): Promise<AIProvider> {
  const name = getProviderName()
  if (cached && cachedName === name) return cached

  switch (name) {
    case 'anthropic':
      cached = (await import('./providers/anthropic')).anthropicProvider
      break
    case 'bedrock':
      cached = (await import('./providers/bedrock')).bedrockProvider
      break
    default:
      cached = (await import('./providers/openrouter')).openRouterProvider
  }
  cachedName = name
  return cached
}

/** Non-streaming chat completion through the active provider. */
export async function complete(
  messages: ChatMessage[],
  config: Partial<ModelConfig> = {}
): Promise<CompletionResponse> {
  return (await getAIProvider()).complete(messages, config)
}

/** Streaming SSE response (`data: {"text":...}` then `data: {"done":true}`). */
export async function streamResponse(
  messages: ChatMessage[],
  config: Partial<ModelConfig> = {}
): Promise<Response> {
  return (await getAIProvider()).streamResponse(messages, config)
}

/** Extract JSON from AI output that may be wrapped in markdown code fences. */
export function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : text.trim()
}
