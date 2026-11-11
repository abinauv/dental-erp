import { defineConfig } from 'prisma/config'

// Configuration for the Prisma CLI (generate, migrate, db seed, studio). The
// app connects through lib/prisma.ts instead.

// Prisma 7 no longer reads .env by itself. Load it when there is one (local
// development); variables already set in the environment win. In Docker and
// CI they come from the environment and there is no .env.
try {
  process.loadEnvFile()
} catch {
  // No .env file.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` runs without a database (CI, the Docker build), so the
  // URL is only required by the commands that connect.
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
})
