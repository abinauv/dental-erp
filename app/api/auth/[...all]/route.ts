import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

// Better Auth's catch-all handler. The sibling static route
// app/api/auth/mobile-token takes precedence for that path, so the mobile
// Bearer-token endpoint is unaffected.
export const { GET, POST } = toNextJsHandler(auth)
