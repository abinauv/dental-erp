/**
 * Shared implementation for the Claude-backed providers (Anthropic direct and
 * Amazon Bedrock). Both SDK clients expose the same `messages.create` /
 * `messages.stream` surface, so one factory serves both — the caller supplies a
 * client getter and a model-id prefix (`''` for Anthropic, `'anthropic.'` for
 * Bedrock).
 *
 * The logical tiers (lib/ai/models) are OpenRouter/Gemini strings; `resolve
 * ClaudeModel` maps them to a Claude model since these providers serve Claude
 * only. `temperature` is intentionally NOT sent: current Claude models reject a
 * non-default `temperature` (depth is controlled by effort/adaptive thinking).
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, ChatMessage, CompletionResponse } from '../provider'
import type { ModelConfig } from '../models'
import { resolveClaudeModel } from '../models'

// Anthropic's Messages API takes system text as a top-level field, not as a
// message with role 'system' — split it out and keep the user/assistant turns.
function splitMessages(messages: ChatMessage[]): {
  system?: string
  turns: { role: 'user' | 'assistant'; content: string }[]
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  return { system: system || undefined, turns }
}

export function createClaudeProvider(getClient: () => Anthropic, prefix = ''): AIProvider {
  async function complete(
    messages: ChatMessage[],
    config: Partial<ModelConfig> = {}
  ): Promise<CompletionResponse> {
    const model = prefix + resolveClaudeModel(config.model)
    const { system, turns } = splitMessages(messages)

    const res = await getClient().messages.create({
      model,
      max_tokens: config.maxTokens || 4096,
      ...(system ? { system } : {}),
      messages: turns,
    })

    const content = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const input = res.usage?.input_tokens || 0
    const output = res.usage?.output_tokens || 0
    return {
      content,
      usage: { promptTokens: input, completionTokens: output, totalTokens: input + output },
      model: res.model || model,
    }
  }

  async function streamResponse(
    messages: ChatMessage[],
    config: Partial<ModelConfig> = {}
  ): Promise<Response> {
    const model = prefix + resolveClaudeModel(config.model)
    const { system, turns } = splitMessages(messages)
    const encoder = new TextEncoder()

    const stream = getClient().messages.stream({
      model,
      max_tokens: config.maxTokens || 4096,
      ...(system ? { system } : {}),
      messages: turns,
    })

    const output = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err?.message || 'stream error' })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(output, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  return { complete, streamResponse }
}
