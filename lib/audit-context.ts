import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Who is making the current request's changes, for the audit log
 * (lib/audit-log.ts). The code that authenticates a request fills it in, and
 * every database write made while handling that request is logged as theirs.
 * Writes made with no actor (scheduled jobs, webhooks, public pages) are logged
 * as the system.
 */
export type AuditSource = 'web' | 'mobile' | 'patient-portal'

export interface AuditActor {
  userId?: string
  hospitalId?: string
  source?: AuditSource
  ipAddress?: string
  userAgent?: string
}

// One store per process. Next.js bundles this module into several server
// chunks, so a route's copy and the copy the shared Prisma client
// (lib/prisma) was built with would otherwise be different stores, and the
// client would never see the actor the route set.
const globalForAudit = globalThis as unknown as {
  auditActors: AsyncLocalStorage<AuditActor> | undefined
}
const storage = (globalForAudit.auditActors ??= new AsyncLocalStorage<AuditActor>())

/**
 * Starts a new, empty actor for the rest of the current request and returns it
 * for the caller to fill in once it knows who is asking.
 *
 * Call it before the first `await` in the function that authenticates. An async
 * function runs synchronously up to its first await, in its caller's context,
 * so the actor set here reaches the route handler that called it and
 * everything the handler awaits afterwards. Set after an await, it would reach
 * only the rest of the authenticating function.
 */
export function beginAuditActor(): AuditActor {
  const actor: AuditActor = {}
  storage.enterWith(actor)
  return actor
}

/** Runs `fn` with `actor` as the one making changes (filled in later or not). */
export function runAsAuditActor<T>(actor: AuditActor, fn: () => T): T {
  return storage.run(actor, fn)
}

export function currentAuditActor(): AuditActor | undefined {
  return storage.getStore()
}

/** A User-Agent as the AuditLog column holds it (VARCHAR(191)). */
export function auditUserAgent(value: string | null | undefined): string | undefined {
  return value ? value.slice(0, 191) : undefined
}
