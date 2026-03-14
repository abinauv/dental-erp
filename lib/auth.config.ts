import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      // Public routes that don't require auth
      const publicRoutes = [
        "/login",
        "/forgot-password",
        "/signup",
        "/pricing",
        "/verify-email",
        "/invite/accept",
      ]

      const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route)
      )
      const isLandingPage = pathname === "/"

      if (isPublicRoute || isLandingPage) {
        // If logged in and trying to access login/signup, redirect to dashboard
        if (isLoggedIn && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      // All other routes require authentication
      if (!isLoggedIn) return false

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.staffId = user.staffId
        token.hospitalId = user.hospitalId
        token.isHospitalAdmin = user.isHospitalAdmin
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.staffId = token.staffId as string | undefined
        session.user.hospitalId = token.hospitalId as string
        session.user.isHospitalAdmin = token.isHospitalAdmin as boolean
      }
      return session
    },
  },
  providers: [],
}
