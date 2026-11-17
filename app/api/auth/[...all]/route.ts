import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { auditUserAgent, runAsAuditActor } from '@/lib/audit-context'
import { clientAddress } from '@/lib/trusted-proxies'

// Better Auth's catch-all handler. The sibling static route
// app/api/auth/mobile-token takes precedence for that path, so the mobile
// Bearer-token endpoint is unaffected.
const handler = toNextJsHandler(auth)

// Changes made here (a password change or reset) go into the audit log as
// made from the web; lib/auth fills in who once it knows.
function audited(handle: (request: Request) => Promise<Response>) {
  return (request: Request) =>
    runAsAuditActor(
      {
        source: 'web',
        ipAddress: clientAddress(request.headers) ?? undefined,
        userAgent: auditUserAgent(request.headers.get('user-agent')),
      },
      () => handle(request)
    )
}

export const GET = audited(handler.GET)
export const POST = audited(handler.POST)
