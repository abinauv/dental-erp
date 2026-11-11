import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mariadbPoolConfig } from '@/lib/database-url'

describe('mariadbPoolConfig', () => {
  it('maps a plain URL with the driver defaults Prisma used', () => {
    expect(mariadbPoolConfig('mysql://dental:secret@mysql:3306/dental_erp')).toEqual({
      user: 'dental',
      password: 'secret',
      database: 'dental_erp',
      host: 'mysql',
      port: 3306,
      acquireTimeout: 10_000,
      connectTimeout: 5_000,
      allowPublicKeyRetrieval: true,
    })
  })

  it('maps the Docker Compose pool parameters', () => {
    const config = mariadbPoolConfig('mysql://u:p@mysql:3306/db?connection_limit=7&pool_timeout=20')
    expect(config.connectionLimit).toBe(7)
    expect(config.acquireTimeout).toBe(20_000)
  })

  it('maps connect_timeout to milliseconds', () => {
    expect(mariadbPoolConfig('mysql://u:p@h/db?connect_timeout=2').connectTimeout).toBe(2_000)
  })

  it('decodes percent-encoded credentials and database names', () => {
    const config = mariadbPoolConfig('mysql://us%40er:p%2Fa%3Ass%23@h:3307/my%2Ddb')
    expect(config.user).toBe('us@er')
    expect(config.password).toBe('p/a:ss#')
    expect(config.database).toBe('my-db')
    expect(config.port).toBe(3307)
  })

  it('defaults the port to 3306 and accepts IPv6 hosts', () => {
    const config = mariadbPoolConfig('mysql://u:p@[::1]/db')
    expect(config.host).toBe('::1')
    expect(config.port).toBe(3306)
  })

  it('uses a Unix socket instead of host and port', () => {
    const config = mariadbPoolConfig('mysql://u:p@localhost/db?socket=/var/run/mysqld/mysqld.sock')
    expect(config.socketPath).toBe('/var/run/mysqld/mysqld.sock')
    expect(config.host).toBeUndefined()
    expect(config.port).toBeUndefined()
  })

  it('accepts mariadb:// URLs', () => {
    expect(mariadbPoolConfig('mariadb://u:p@h/db').host).toBe('h')
  })

  it('encrypts and verifies with sslaccept=strict', () => {
    const config = mariadbPoolConfig('mysql://u:p@h/db?sslaccept=strict')
    expect(config.ssl).toEqual({ rejectUnauthorized: true })
    expect(config.allowPublicKeyRetrieval).toBeUndefined()
  })

  it('encrypts without verifying with sslaccept=accept_invalid_certs', () => {
    expect(mariadbPoolConfig('mysql://u:p@h/db?sslaccept=accept_invalid_certs').ssl).toEqual({
      rejectUnauthorized: false,
    })
  })

  it('verifies against the CA in sslcert', () => {
    const dir = mkdtempSync(join(tmpdir(), 'db-url-'))
    const ca = join(dir, 'ca.pem')
    writeFileSync(ca, 'CERT')
    const config = mariadbPoolConfig(`mysql://u:p@h/db?sslcert=${encodeURIComponent(ca)}`)
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true })
    expect(String((config.ssl as { ca: Buffer }).ca)).toBe('CERT')
  })

  it.each([
    ['not a url', /not a valid URL/],
    ['postgresql://u:p@h/db', /must be a mysql:\/\/ URL/],
    ['mysql://u:p@h/db?connection_limit=0', /connection_limit/],
    ['mysql://u:p@h/db?connection_limit=2.5', /connection_limit/],
    ['mysql://u:p@h/db?pool_timeout=soon', /pool_timeout/],
    ['mysql://u:p@h/db?sslaccept=yes', /sslaccept/],
  ])('rejects %s', (url, message) => {
    expect(() => mariadbPoolConfig(url)).toThrow(message)
  })
})
