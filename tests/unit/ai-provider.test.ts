import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveClaudeModel } from '@/lib/ai/models'

describe('AI provider registry', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('defaults to openrouter when AI_PROVIDER is unset', async () => {
    vi.stubEnv('AI_PROVIDER', '')
    const { getProviderName } = await import('@/lib/ai/provider')
    expect(getProviderName()).toBe('openrouter')
  })

  it('honours AI_PROVIDER=anthropic / bedrock', async () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic')
    let mod = await import('@/lib/ai/provider')
    expect(mod.getProviderName()).toBe('anthropic')

    vi.resetModules()
    vi.stubEnv('AI_PROVIDER', 'bedrock')
    mod = await import('@/lib/ai/provider')
    expect(mod.getProviderName()).toBe('bedrock')
  })

  it('falls back to openrouter for an unknown provider value', async () => {
    vi.stubEnv('AI_PROVIDER', 'nope')
    const { getProviderName } = await import('@/lib/ai/provider')
    expect(getProviderName()).toBe('openrouter')
  })

  it('resolves the default provider to one with complete + streamResponse', async () => {
    vi.stubEnv('AI_PROVIDER', '')
    const { getAIProvider } = await import('@/lib/ai/provider')
    const provider = await getAIProvider()
    expect(typeof provider.complete).toBe('function')
    expect(typeof provider.streamResponse).toBe('function')
  })
})

describe('resolveClaudeModel — logical tier → Claude model', () => {
  it('maps the premium tier to Opus', () => {
    expect(resolveClaudeModel('anthropic/claude-opus-4.5')).toBe('claude-opus-5-5')
  })

  it('maps the lightweight tier to Haiku', () => {
    expect(resolveClaudeModel('google/gemini-2.5-flash-lite')).toBe('claude-haiku-5-5')
  })

  it('maps the standard tier (and unknowns) to Sonnet', () => {
    expect(resolveClaudeModel('google/gemini-2.5-pro')).toBe('claude-sonnet-5-5')
    expect(resolveClaudeModel(undefined)).toBe('claude-sonnet-5-5')
  })
})

describe('extractJSON', () => {
  it('unwraps a fenced json block', async () => {
    const { extractJSON } = await import('@/lib/ai/provider')
    expect(extractJSON('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('returns trimmed text when there is no fence', async () => {
    const { extractJSON } = await import('@/lib/ai/provider')
    expect(extractJSON('  {"a":1}  ')).toBe('{"a":1}')
  })
})
