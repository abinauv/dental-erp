import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

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

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user
  const pathname = nextUrl.pathname

  // Public routes - allow access
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
  const isLandingPage = pathname === '/'
  const isApiRoute = pathname.startsWith('/api/')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isPublicApi = pathname.startsWith('/api/public')

  // Let all API routes through - they handle their own auth via getAuthenticatedHospital()
  // This is required for mobile app Bearer token auth which bypasses NextAuth cookies
  if (isApiRoute) {
    return NextResponse.next()
  }

  if (isPublicRoute || isLandingPage || isApiAuth || isPublicApi) {
    // If logged in and trying to access login/signup/landing, redirect to dashboard
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

  // Onboarding redirect: if hospital hasn't completed onboarding, force them there
  // (Skip if already on onboarding page or API routes)
  if (pathname.startsWith('/onboarding') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check role-based access
  const userRole = session.user.role
  for (const [path, roles] of Object.entries(roleRoutes)) {
    if (pathname.startsWith(path)) {
      if (!roles.includes(userRole)) {
        // User doesn't have required role - redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', nextUrl))
      }
    }
  }

  return NextResponse.next()
})

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
     * that they never invoke auth() at all. An orchestrator polls these every
     * few seconds for the life of the container; making each poll decode a
     * session is wasted work, and it couples the probe to the auth layer, so
     * a fault in auth would take the health check down with it — exactly when
     * an accurate health signal matters most.
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/health|api/ready).*)',
  ],
}
