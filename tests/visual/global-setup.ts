import { mkdirSync } from 'node:fs'
import { request, type FullConfig } from '@playwright/test'

// Sign in once as the seeded admin and share the session with every page, so
// the run makes one sign-in request instead of one per page (sign-in is rate
// limited to 5 a minute).
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
  const res = await ctx.post('/api/auth/sign-in/email', {
    data: {
      email: process.env.VISUAL_EMAIL ?? 'admin@demo-dental.com',
      password: process.env.VISUAL_PASSWORD ?? 'Admin@123',
    },
  })
  if (!res.ok()) {
    throw new Error(`Visual setup: sign-in failed (${res.status()}): ${await res.text()}`)
  }
  mkdirSync('.visual', { recursive: true })
  await ctx.storageState({ path: '.visual/auth.json' })
  await ctx.dispose()
}
