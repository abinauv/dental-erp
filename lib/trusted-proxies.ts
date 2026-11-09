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
