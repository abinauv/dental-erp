import type { NextAuthOptions } from 'next-auth'

export const authConfig: Pick<NextAuthOptions, 'pages' | 'callbacks'> = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
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
}
