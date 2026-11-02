/**
 * OpenRouter provider (default). OpenAI-compatible chat completions over HTTP;
 * model strings are OpenRouter identifiers (e.g. `google/gemini-2.5-pro`).
 */

import type { AIProvider, ChatMessage, CompletionResponse } from '../provider'
import type { ModelConfig } from '../models'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

function getHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set. Add it to your .env file.')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
    'X-Title': 'DentalERP AI',
  }
}

async function complete(
  messages: ChatMessage[],
  config: Partial<ModelConfig> = {}
): Promise<CompletionResponse> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: config.model || 'google/gemini-2.5-pro',
      messages,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0.7,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter [${res.status}]: ${await res.text()}`)
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model || config.model || 'unknown',
  }
}

async function streamResponse(
  messages: ChatMessage[],
  config: Partial<ModelConfig> = {}
): Promise<Response> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: config.model || 'google/gemini-2.5-pro',
      messages,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0.7,
      stream: true,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter stream [${res.status}]: ${await res.text()}`)
  }

  const body = res.body
  if (!body) throw new Error('Empty response body from OpenRouter')

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const output = body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true })
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
            return
          }
          try {
            const parsed = JSON.parse(payload)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`))
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      },
    })
  )

  return new Response(output, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export const openRouterProvider: AIProvider = { complete, streamResponse }
