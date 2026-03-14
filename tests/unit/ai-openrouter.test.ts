import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  complete,
  streamResponse,
  extractJSON,
  type ChatMessage,
} from '@/lib/ai/openrouter'

// Mock prisma to avoid DB connection attempts during import resolution
vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIConversation: { findMany: vi.fn(), create: vi.fn() },
    aISkillExecution: { findMany: vi.fn(), create: vi.fn() },
    aIInsight: { findMany: vi.fn(), create: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleMessages: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful dental assistant.' },
  { role: 'user', content: 'What is a root canal?' },
]

function mockFetchSuccess(data: unknown) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response)
}

function mockFetchError(status: number, body: string) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response)
}

// ---------------------------------------------------------------------------
// extractJSON
// ---------------------------------------------------------------------------

describe('extractJSON', () => {
  it('should extract JSON from a ```json ... ``` code block', () => {
    const input = 'Here is the result:\n```json\n{"name":"Alice"}\n```\nDone.'
    expect(extractJSON(input)).toBe('{"name":"Alice"}')
  })

  it('should extract JSON from a ``` ... ``` code block without the json marker', () => {
    const input = 'Output:\n```\n{"count":42}\n```'
    expect(extractJSON(input)).toBe('{"count":42}')
  })

  it('should return trimmed plain text when no code block is present', () => {
    const input = '  {"plain":"value"}  '
    expect(extractJSON(input)).toBe('{"plain":"value"}')
  })

  it('should handle multiline JSON inside a code block', () => {
    const input = '```json\n{\n  "a": 1,\n  "b": 2\n}\n```'
    const result = extractJSON(input)
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
  })

  it('should handle code block with extra whitespace', () => {
    const input = '```json\n   {"spaced": true}   \n```'
    expect(extractJSON(input)).toBe('{"spaced": true}')
  })

  it('should extract only the first code block when multiple exist', () => {
    const input = '```json\n{"first":true}\n```\nand also\n```json\n{"second":true}\n```'
    expect(extractJSON(input)).toBe('{"first":true}')
  })

  it('should handle empty code block', () => {
    const input = '```json\n\n```'
    expect(extractJSON(input)).toBe('')
  })

  it('should return empty string when input is only whitespace', () => {
    expect(extractJSON('   ')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

describe('complete', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset()
    process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key'
  })

  it('should call fetch with the correct URL', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'Test reply' } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      model: 'google/gemini-2.5-pro',
    })

    await complete(sampleMessages)

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url] = vi.mocked(global.fetch).mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('should send correct headers including Bearer token', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'test-model',
    })

    await complete(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-openrouter-api-key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Title']).toBe('DentalERP AI')
    expect(headers['HTTP-Referer']).toBe('http://localhost:3000')
  })

  it('should use default model, maxTokens, and temperature when no config is provided', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'default' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'google/gemini-2.5-pro',
    })

    await complete(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.model).toBe('google/gemini-2.5-pro')
    expect(body.max_tokens).toBe(4096)
    expect(body.temperature).toBe(0.7)
  })

  it('should use custom config values when provided', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'custom' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'anthropic/claude-opus-4-5-20251101',
    })

    await complete(sampleMessages, {
      model: 'anthropic/claude-opus-4-5-20251101',
      maxTokens: 8192,
      temperature: 0.2,
    })

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.model).toBe('anthropic/claude-opus-4-5-20251101')
    expect(body.max_tokens).toBe(8192)
    expect(body.temperature).toBe(0.2)
  })

  it('should send messages in the request body', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'hi' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'test',
    })

    await complete(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.messages).toEqual(sampleMessages)
  })

  it('should use POST method', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'post' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'test',
    })

    await complete(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    expect((options as RequestInit).method).toBe('POST')
  })

  it('should parse response content correctly', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'A root canal is a dental procedure.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'google/gemini-2.5-pro',
    })

    const result = await complete(sampleMessages)

    expect(result.content).toBe('A root canal is a dental procedure.')
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    })
    expect(result.model).toBe('google/gemini-2.5-pro')
  })

  it('should default content to empty string when choices are missing', async () => {
    mockFetchSuccess({
      choices: [],
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      model: 'test-model',
    })

    const result = await complete(sampleMessages)
    expect(result.content).toBe('')
  })

  it('should default usage values to 0 when usage is missing', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'no usage' } }],
      model: 'test-model',
    })

    const result = await complete(sampleMessages)
    expect(result.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    })
  })

  it('should fall back to config model when response model is missing', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })

    const result = await complete(sampleMessages, { model: 'my-model' })
    expect(result.model).toBe('my-model')
  })

  it('should fall back to "unknown" when both response model and config model are missing', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })

    const result = await complete(sampleMessages)
    // config.model is undefined, so falls through to "unknown"
    // Actually, config.model is undefined so data.model || config.model || "unknown" => "unknown"
    expect(result.model).toBe('unknown')
  })

  it('should throw on non-OK response with status code and body text', async () => {
    mockFetchError(500, 'Internal Server Error')

    await expect(complete(sampleMessages)).rejects.toThrow(
      'OpenRouter [500]: Internal Server Error'
    )
  })

  it('should throw on 429 rate limit response', async () => {
    mockFetchError(429, 'Rate limit exceeded')

    await expect(complete(sampleMessages)).rejects.toThrow(
      'OpenRouter [429]: Rate limit exceeded'
    )
  })

  it('should throw on 401 unauthorized response', async () => {
    mockFetchError(401, 'Invalid API key')

    await expect(complete(sampleMessages)).rejects.toThrow(
      'OpenRouter [401]: Invalid API key'
    )
  })

  it('should handle temperature of 0 correctly (not fallback to default)', async () => {
    mockFetchSuccess({
      choices: [{ message: { content: 'deterministic' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'test',
    })

    await complete(sampleMessages, { temperature: 0 })

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    // Uses nullish coalescing (??) so 0 is preserved, not replaced with 0.7
    expect(body.temperature).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// complete — getHeaders (tested indirectly via complete)
// ---------------------------------------------------------------------------

describe('getHeaders (via complete)', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset()
  })

  it('should work when OPENROUTER_API_KEY is set', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key'

    mockFetchSuccess({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'test',
    })

    // Should not throw
    await expect(complete(sampleMessages)).resolves.toBeDefined()
  })

  it('should throw when OPENROUTER_API_KEY is not set', async () => {
    const originalKey = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY

    await expect(complete(sampleMessages)).rejects.toThrow(
      'OPENROUTER_API_KEY is not set'
    )

    // Restore for other tests
    process.env.OPENROUTER_API_KEY = originalKey
  })

  it('should throw when OPENROUTER_API_KEY is empty string', async () => {
    const originalKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = ''

    await expect(complete(sampleMessages)).rejects.toThrow(
      'OPENROUTER_API_KEY is not set'
    )

    process.env.OPENROUTER_API_KEY = originalKey
  })

  it('should use NEXTAUTH_URL as HTTP-Referer', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key'
    process.env.NEXTAUTH_URL = 'https://my-dental-app.com'

    mockFetchSuccess({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: 'test',
    })

    await complete(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers['HTTP-Referer']).toBe('https://my-dental-app.com')

    // Restore
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
  })
})

// ---------------------------------------------------------------------------
// streamResponse
// ---------------------------------------------------------------------------

describe('streamResponse', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset()
    process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key'
  })

  it('should call fetch with stream:true in the body', async () => {
    const readable = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    await streamResponse(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.stream).toBe(true)
  })

  it('should call fetch with the correct URL', async () => {
    const readable = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    await streamResponse(sampleMessages)

    const [url] = vi.mocked(global.fetch).mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('should return a Response with text/event-stream Content-Type', async () => {
    const readable = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    const response = await streamResponse(sampleMessages)

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Connection')).toBe('keep-alive')
  })

  it('should use default config values when no config is provided', async () => {
    const readable = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    await streamResponse(sampleMessages)

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.model).toBe('google/gemini-2.5-pro')
    expect(body.max_tokens).toBe(4096)
    expect(body.temperature).toBe(0.7)
  })

  it('should use custom config values when provided', async () => {
    const readable = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    await streamResponse(sampleMessages, {
      model: 'anthropic/claude-opus-4-5-20251101',
      maxTokens: 8192,
      temperature: 0.2,
    })

    const [, options] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.model).toBe('anthropic/claude-opus-4-5-20251101')
    expect(body.max_tokens).toBe(8192)
    expect(body.temperature).toBe(0.2)
  })

  it('should throw on non-OK response with status code and body text', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as unknown as Response)

    await expect(streamResponse(sampleMessages)).rejects.toThrow(
      'OpenRouter stream [503]: Service Unavailable'
    )
  })

  it('should throw on 500 error response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as unknown as Response)

    await expect(streamResponse(sampleMessages)).rejects.toThrow(
      'OpenRouter stream [500]: Internal Server Error'
    )
  })

  it('should throw when response body is null', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: null,
    } as unknown as Response)

    await expect(streamResponse(sampleMessages)).rejects.toThrow(
      'Empty response body from OpenRouter'
    )
  })

  it('should throw when response body is undefined', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: undefined,
    } as unknown as Response)

    await expect(streamResponse(sampleMessages)).rejects.toThrow(
      'Empty response body from OpenRouter'
    )
  })

  it('should transform SSE chunks with delta content into { text } events', async () => {
    const encoder = new TextEncoder()
    const sseChunk = encoder.encode(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n' +
      'data: [DONE]\n\n'
    )

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(sseChunk)
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    const response = await streamResponse(sampleMessages)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    let fullOutput = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullOutput += decoder.decode(value, { stream: true })
    }

    // Should contain the transformed events
    expect(fullOutput).toContain('data: {"text":"Hello"}')
    expect(fullOutput).toContain('data: {"text":" world"}')
    expect(fullOutput).toContain('data: {"done":true}')
  })

  it('should skip SSE lines that do not start with "data: "', async () => {
    const encoder = new TextEncoder()
    const sseChunk = encoder.encode(
      ': comment line\n' +
      'event: ping\n' +
      'data: {"choices":[{"delta":{"content":"kept"}}]}\n\n'
    )

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(sseChunk)
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    const response = await streamResponse(sampleMessages)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    let fullOutput = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullOutput += decoder.decode(value, { stream: true })
    }

    expect(fullOutput).toContain('data: {"text":"kept"}')
    // Should not contain comment or event lines
    expect(fullOutput).not.toContain('comment')
    expect(fullOutput).not.toContain('ping')
  })

  it('should skip chunks with empty delta content', async () => {
    const encoder = new TextEncoder()
    const sseChunk = encoder.encode(
      'data: {"choices":[{"delta":{}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"visible"}}]}\n\n' +
      'data: [DONE]\n\n'
    )

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(sseChunk)
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    const response = await streamResponse(sampleMessages)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    let fullOutput = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullOutput += decoder.decode(value, { stream: true })
    }

    // Only "visible" content chunk and done signal should appear
    expect(fullOutput).toContain('data: {"text":"visible"}')
    expect(fullOutput).toContain('data: {"done":true}')
    // Count data: entries — should be exactly 2 (text + done)
    const dataEntries = fullOutput.match(/data: /g)
    expect(dataEntries).toHaveLength(2)
  })

  it('should gracefully handle malformed JSON in SSE data', async () => {
    const encoder = new TextEncoder()
    const sseChunk = encoder.encode(
      'data: {invalid json\n\n' +
      'data: {"choices":[{"delta":{"content":"after-error"}}]}\n\n' +
      'data: [DONE]\n\n'
    )

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(sseChunk)
        controller.close()
      },
    })

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: readable,
    } as unknown as Response)

    const response = await streamResponse(sampleMessages)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    let fullOutput = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullOutput += decoder.decode(value, { stream: true })
    }

    // Malformed chunk should be skipped, valid chunks should be processed
    expect(fullOutput).toContain('data: {"text":"after-error"}')
    expect(fullOutput).toContain('data: {"done":true}')
    expect(fullOutput).not.toContain('invalid json')
  })

  it('should throw when OPENROUTER_API_KEY is not set', async () => {
    const originalKey = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY

    await expect(streamResponse(sampleMessages)).rejects.toThrow(
      'OPENROUTER_API_KEY is not set'
    )

    process.env.OPENROUTER_API_KEY = originalKey
  })
})
