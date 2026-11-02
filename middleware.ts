import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// Routes that require specific roles
const roleRoutes: Record<string, string[]> = {
  '/settings': ['ADMIN'],
  '/staff': ['ADMIN'],
  '/inventory': ['ADMIN'],
  '/billing': ['ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'],
  '/lab': ['ADMIN', 'DOCTOR', 'LAB_TECH'],
  '/treatments': ['ADMIN', 'DOCTOR'],
  '/reports': ['ADMIN', 'ACCOUNTANT', 'DOCTOR'],
  '/communications': ['ADMIN', 'RECEPTIONIST'],
}

// Public routes that don't require authentication.
//
// Everything under /portal and /pay is patient-facing and must not be gated by
// the staff session: patients have their own cookie, issued by the OTP flow and
// checked in app/portal/(secure)/layout.tsx. Gating them here sent patients to
// the staff login page, which made the portal unreachable entirely.
const publicRoutes = [
  '/login',
  '/forgot-password',
  '/signup',
  '/pricing',
  '/verify-email',
  '/invite/accept',
  '/portal',
  '/pay',
]

// Fetch the full session (incl. role) for role-gated prefixes. getSessionCookie
// is presence-only, so role checks need the session itself. This runs only on
// navigations to role-gated areas, keeping the common path cookie-only.
async function getSessionRole(req: NextRequest, origin: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/api/auth/get-session`, {
      headers: { cookie: req.headers.get('cookie') || '' },
      // Avoid caching a per-user session response.
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.user?.role as string) ?? null
  } catch {
    return null
  }
}

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  // Let all API routes through — they handle their own auth via
  // getAuthenticatedHospital() (which also supports mobile Bearer tokens).
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Optimistic cookie-only check (no DB hit). Protected pages/actions still
  // validate the session server-side.
  const isLoggedIn = !!getSessionCookie(req)

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
  const isLandingPage = pathname === '/'

  if (isPublicRoute || isLandingPage) {
    if (isLoggedIn && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  // Protected routes - require authentication
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Onboarding page is allowed for any logged-in user.
  if (pathname.startsWith('/onboarding')) {
    return NextResponse.next()
  }

  // Role-based access for the gated prefixes.
  const gatedPrefix = Object.keys(roleRoutes).find((p) => pathname.startsWith(p))
  if (gatedPrefix) {
    const role = await getSessionRole(req, nextUrl.origin)
    if (role && !roleRoutes[gatedPrefix].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/health and api/ready — the liveness and readiness probes.
     *
     * The probes are excluded here rather than allowed through the handler so
     * that they never invoke auth at all. An orchestrator polls these every
     * few seconds for the life of the container; making each poll decode a
     * session is wasted work, and it couples the probe to the auth layer, so
     * a fault in auth would take the health check down with it — exactly when
     * an accurate health signal matters most.
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/health|api/ready).*)',
  ],
}
