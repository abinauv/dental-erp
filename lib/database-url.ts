import { readFileSync } from 'node:fs'
import type { PoolConfig } from 'mariadb'

/**
 * Turns DATABASE_URL into settings for the mariadb driver behind Prisma's
 * MySQL adapter (lib/prisma.ts).
 *
 * The URL keeps the format Prisma has always documented, including its
 * connection parameters, which the driver doesn't understand by those names:
 *
 *   connection_limit   pool size (default 10)
 *   pool_timeout       seconds to wait for a free connection (default 10)
 *   connect_timeout    seconds to wait for a new connection (default 5)
 *   socket             Unix socket path, instead of host and port
 *   sslaccept          `strict` (verify the server certificate) or
 *                      `accept_invalid_certs` (encrypt without verifying)
 *   sslcert            CA certificate file to verify the server against
 *
 * Without `sslaccept` or `sslcert` the connection is not encrypted, as on the
 * private network of the bundled Docker Compose setup.
 */
export function mariadbPoolConfig(databaseUrl: string): PoolConfig {
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error(
      'DATABASE_URL is not a valid URL (expected mysql://user:password@host:3306/database)'
    )
  }
  if (url.protocol !== 'mysql:' && url.protocol !== 'mariadb:') {
    throw new Error(`DATABASE_URL must be a mysql:// URL, not ${url.protocol}//`)
  }

  const params = url.searchParams
  const seconds = (name: string, fallback: number) => {
    const value = params.get(name)
    if (value === null || value === '') return fallback * 1000
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0)
      throw new Error(`DATABASE_URL: ${name} must be a number of seconds`)
    return n * 1000
  }

  const config: PoolConfig = {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || undefined,
    acquireTimeout: seconds('pool_timeout', 10),
    connectTimeout: seconds('connect_timeout', 5),
  }

  const socket = params.get('socket')
  if (socket) {
    config.socketPath = socket
  } else {
    config.host = decodeURIComponent(url.hostname).replace(/^\[(.*)\]$/, '$1') || 'localhost'
    config.port = url.port ? Number(url.port) : 3306
  }

  const limit = params.get('connection_limit')
  if (limit) {
    const n = Number(limit)
    if (!Number.isInteger(n) || n < 1)
      throw new Error('DATABASE_URL: connection_limit must be a whole number above 0')
    config.connectionLimit = n
  }

  const sslaccept = params.get('sslaccept')
  const sslcert = params.get('sslcert')
  if (sslaccept || sslcert) {
    if (sslaccept && sslaccept !== 'strict' && sslaccept !== 'accept_invalid_certs') {
      throw new Error('DATABASE_URL: sslaccept must be strict or accept_invalid_certs')
    }
    config.ssl = {
      rejectUnauthorized: sslaccept !== 'accept_invalid_certs',
      ...(sslcert ? { ca: readFileSync(sslcert) } : {}),
    }
  } else {
    // MySQL 8's default sign-in method (caching_sha2_password) needs the
    // server's RSA key to send the password over an unencrypted connection.
    config.allowPublicKeyRetrieval = true
  }

  return config
}
