import mysql from 'mysql2/promise'

/**
 * Connection settings for the raw mysql2 pool used by the inventory and lab
 * routes (everything else goes through Prisma).
 *
 * DATABASE_URL is the only database variable this repo actually configures —
 * .env, .env.example, and both GitHub workflows set it and nothing else. The
 * DB_HOST/DB_USER/... variables below are kept as an escape hatch, but they
 * must not be the default: when they were, CI fell back to root@localhost with
 * an empty password against a `dental_erp` database that does not exist there,
 * so every raw-SQL route answered 500 with ER_ACCESS_DENIED_ERROR.
 */
function poolConfig(): mysql.PoolOptions {
  const url = process.env.DATABASE_URL

  if (url) {
    try {
      const parsed = new URL(url)
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        // Credentials are percent-encoded in a URL; decode so passwords
        // containing characters like @ or / survive the round trip.
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ''),
      }
    } catch {
      // Fall through to the discrete variables rather than taking the whole
      // app down over a malformed URL.
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dental_erp',
  }
}

const pool = mysql.createPool({
  ...poolConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
})

export default pool
