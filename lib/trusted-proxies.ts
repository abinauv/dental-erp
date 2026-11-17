import { BlockList, isIP } from 'node:net'

/**
 * Reverse proxies whose X-Forwarded-For entries are trusted, from
 * TRUSTED_PROXIES (comma-separated IPs or CIDR ranges). Leave it unset behind a
 * single proxy that overwrites the header, like the bundled Caddy config; set it
 * when the app sits behind a chain (e.g. a CDN in front of nginx) so the client
 * can be found by reading the chain from the right.
 *
 * Read by the app's rate limiter (lib/rate-limit) and by Better Auth's sign-in
 * limiter (lib/auth), so both agree on who the client is.
 */
export function trustedProxies(value = process.env.TRUSTED_PROXIES): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function ipFamily(ip: string): 'ipv4' | 'ipv6' | null {
  const family = isIP(ip)
  return family === 4 ? 'ipv4' : family === 6 ? 'ipv6' : null
}

function toBlockList(entries: string[]): BlockList {
  const list = new BlockList()
  for (const entry of entries) {
    const [address, prefix] = entry.split('/')
    const family = ipFamily(address)
    if (!family) continue
    try {
      if (prefix === undefined) list.addAddress(address, family)
      else list.addSubnet(address, Number(prefix), family)
    } catch {
      // A malformed range is ignored rather than failing every request.
    }
  }
  return list
}

/**
 * The client's address from a request's X-Forwarded-For, or null when it
 * can't be believed. Follows the same rules as Better Auth's sign-in limiter.
 * The leftmost entry is whatever the client sent, so:
 * - with TRUSTED_PROXIES set, the chain is read from the right, skipping
 *   trusted proxies, and the first untrusted address is the client;
 * - without it, only a single-entry header is believed. That is what a proxy
 *   that overwrites the header sends (the bundled Caddy config does), and what
 *   Next.js sets from the socket when no proxy sent one.
 *
 * Used by the rate limiter (lib/rate-limit) and the audit log.
 */
export function clientAddress(
  headers: { get(name: string): string | null },
  trusted = trustedProxies()
): string | null {
  const chain = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)

  if (trusted.length > 0) {
    const list = toBlockList(trusted)
    for (let i = chain.length - 1; i >= 0; i--) {
      const family = ipFamily(chain[i])
      if (!family) return null
      if (!list.check(chain[i], family)) return chain[i]
    }
    return null
  }

  return chain.length === 1 && ipFamily(chain[0]) ? chain[0] : null
}
