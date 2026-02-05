/**
 * OpenRouter API client.
 * Provides non-streaming completion and streaming SSE response helpers.
 */

import type { ModelConfig } from "./models"

const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
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

function getHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY is not set. Add it to your .env file.")
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
    "X-Title": "DentalERP AI",
  }
}

/**
 * Non-streaming chat completion.
 */
export async function complete(
  messages: ChatMessage[],
  config: Partial<ModelConfig> = {}
): Promise<CompletionResponse> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: config.model || "google/gemini-2.5-pro",
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
    content: data.choices?.[0]?.message?.content || "",
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model || config.model || "unknown",
  }
}

/**
 * Streaming SSE response.
 * Returns a fetch Response with Content-Type: text/event-stream.
 * Client receives: data: {"text":"..."}\n\n events, then data: {"done":true}\n\n
 */
export async function streamResponse(
  messages: ChatMessage[],
  config: Partial<ModelConfig> = {}
): Promise<Response> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: config.model || "google/gemini-2.5-pro",
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
  if (!body) throw new Error("Empty response body from OpenRouter")

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const output = body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true })
        for (const line of text.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data: ")) continue
          const payload = trimmed.slice(6)
          if (payload === "[DONE]") {
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

/**
 * Extract JSON from AI output that may be wrapped in markdown code blocks.
 */
export function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : text.trim()
}
