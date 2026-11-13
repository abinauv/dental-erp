// Next.js calls register() once when a server starts.
export async function register() {
  // Background timers belong in the Node.js server only: not in the Edge
  // runtime, and not in the workers `next build` starts to prerender pages.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { startOutboxScheduler } = await import('@/lib/services/outbox-scheduler')
  startOutboxScheduler()
}
