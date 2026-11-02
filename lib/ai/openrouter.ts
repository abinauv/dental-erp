/**
 * Back-compat surface for the AI layer.
 *
 * The provider is now pluggable (see lib/ai/provider — AI_PROVIDER selects
 * OpenRouter / Anthropic / Bedrock). These re-exports keep existing
 * `@/lib/ai/openrouter` imports working; the OpenRouter implementation itself
 * lives in lib/ai/providers/openrouter.
 */

export { complete, streamResponse, extractJSON } from './provider'
export type { ChatMessage, CompletionUsage, CompletionResponse } from './provider'
