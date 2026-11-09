import { describe, it, expect } from 'vitest'
import { getClientIp } from '@/lib/rate-limit'
import { trustedProxies } from '@/lib/trusted-proxies'

// The leftmost X-Forwarded-For entry is whatever the client sent. These cover
// which entry the rate limiter believes, under the same rules as Better Auth.

function req(forwardedFor?: string) {
  const headers = new Headers()
  if (forwardedFor !== undefined) headers.set('x-forwarded-for', forwardedFor)
  return { headers } as any
}

describe('getClientIp without TRUSTED_PROXIES', () => {
  it('believes a single-entry header (an overwriting proxy, or Next.js from the socket)', () => {
    expect(getClientIp(req('203.0.113.7'), [])).toBe('203.0.113.7')
  })

  it('does not believe the client-supplied first entry of a chain', () => {
    // nginx `$proxy_add_x_forwarded_for`: "<client-supplied>, <real client>"
    expect(getClientIp(req('1.2.3.4, 203.0.113.7'), [])).toBe('unknown')
  })

  it('ignores X-Real-IP, which a client can set too', () => {
    const r = req()
    r.headers.set('x-real-ip', '1.2.3.4')
    expect(getClientIp(r, [])).toBe('unknown')
  })

  it('rejects a value that is not an IP address', () => {
    expect(getClientIp(req('not-an-ip'), [])).toBe('unknown')
  })
})

describe('getClientIp with TRUSTED_PROXIES', () => {
  const trusted = ['10.0.0.0/8', '172.18.0.1']

  it('reads the chain from the right, skipping trusted proxies', () => {
    expect(getClientIp(req('1.2.3.4, 203.0.113.7, 10.1.2.3, 172.18.0.1'), trusted)).toBe(
      '203.0.113.7'
    )
  })

  it('cannot be steered by the client-supplied leftmost entry', () => {
    const a = getClientIp(req('9.9.9.9, 203.0.113.7, 10.1.2.3'), trusted)
    const b = getClientIp(req('8.8.8.8, 203.0.113.7, 10.1.2.3'), trusted)
    expect(a).toBe('203.0.113.7')
    expect(b).toBe(a)
  })

  it('falls back to the shared bucket when every hop is trusted or an entry is junk', () => {
    expect(getClientIp(req('10.1.2.3, 172.18.0.1'), trusted)).toBe('unknown')
    expect(getClientIp(req('203.0.113.7, junk, 10.1.2.3'), trusted)).toBe('unknown')
  })

  it('ignores a malformed TRUSTED_PROXIES entry instead of failing the request', () => {
    expect(getClientIp(req('203.0.113.7, 10.1.2.3'), ['10.0.0.0/99', '10.0.0.0/8'])).toBe(
      '203.0.113.7'
    )
  })
})

describe('getClientIp key normalisation', () => {
  it('treats IPv4-mapped IPv6 as the IPv4 address', () => {
    expect(getClientIp(req('::ffff:203.0.113.7'), [])).toBe('203.0.113.7')
  })

  it('keys IPv6 clients by their /64', () => {
    const a = getClientIp(req('2001:db8:1:2:aaaa::1'), [])
    const b = getClientIp(req('2001:db8:1:2:bbbb:cccc:dddd:eeee'), [])
    expect(a).toBe('2001:0db8:0001:0002::/64')
    expect(b).toBe(a)
    expect(getClientIp(req('2001:db8:1:3::1'), [])).not.toBe(a)
  })
})

describe('trustedProxies', () => {
  it('parses a comma-separated list and skips blanks', () => {
    expect(trustedProxies(' 10.0.0.0/8, ,172.18.0.1 ')).toEqual(['10.0.0.0/8', '172.18.0.1'])
    expect(trustedProxies(undefined)).toEqual([])
  })
})
