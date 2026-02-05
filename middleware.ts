import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Routes that require specific roles
const roleRoutes: Record<string, string[]> = {
  "/settings": ["ADMIN"],
  "/staff": ["ADMIN"],
  "/inventory": ["ADMIN"],
  "/billing": ["ADMIN", "ACCOUNTANT", "RECEPTIONIST"],
  "/lab": ["ADMIN", "DOCTOR", "LAB_TECH"],
  "/treatments": ["ADMIN", "DOCTOR"],
  "/reports": ["ADMIN", "ACCOUNTANT", "DOCTOR"],
  "/communications": ["ADMIN", "RECEPTIONIST"],
}

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/forgot-password",
  "/signup",
  "/pricing",
  "/verify-email",
  "/invite/accept",
]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user
  const pathname = nextUrl.pathname

  // Public routes - allow access
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )
  const isLandingPage = pathname === "/"
  const isApiAuth = pathname.startsWith("/api/auth")
  const isPublicApi = pathname.startsWith("/api/public")

  if (isPublicRoute || isLandingPage || isApiAuth || isPublicApi) {
    // If logged in and trying to access login/signup/landing, redirect to dashboard
    if (
      isLoggedIn &&
      (pathname === "/login" || pathname === "/signup" || pathname === "/")
    ) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.next()
  }

  // Protected routes - require authentication
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Onboarding redirect: if hospital hasn't completed onboarding, force them there
  // (Skip if already on onboarding page or API routes)
  if (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next()
  }

  // Check role-based access
  const userRole = session.user.role
  for (const [path, roles] of Object.entries(roleRoutes)) {
    if (pathname.startsWith(path)) {
      if (!roles.includes(userRole)) {
        // User doesn't have required role - redirect to dashboard
        return NextResponse.redirect(new URL("/dashboard", nextUrl))
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
     * - api routes that don't need auth
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api/health).*)",
  ],
}
