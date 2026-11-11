import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from './generated/prisma/client'
import { mariadbPoolConfig } from './database-url'

type Adapter = NonNullable<ConstructorParameters<typeof PrismaClient>[0]['adapter']>

// Prisma 7 talks to MySQL through a JavaScript driver (mariadb) instead of its
// own engine; DATABASE_URL is translated into the driver's settings.
function createAdapter(): Adapter {
  const url = process.env.DATABASE_URL
  if (!url) {
    // `next build` loads this module without a database. Fail on first use,
    // as Prisma did before, rather than on import.
    return {
      provider: 'mysql',
      adapterName: '@prisma/adapter-mariadb',
      connect: () => Promise.reject(new Error('DATABASE_URL is not set')),
    }
  }
  const config = mariadbPoolConfig(url)
  return new PrismaMariaDb(config, { database: config.database })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// One client per process, in production too: Next.js bundles this module into
// several server chunks (route handlers, pages, proxy.ts), and each copy would
// otherwise open its own pool of connection_limit connections.
globalForPrisma.prisma = prisma

export default prisma
