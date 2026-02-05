import "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    email: string
    name: string
    role: string
    staffId?: string
    hospitalId: string
    isHospitalAdmin: boolean
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      staffId?: string
      hospitalId: string
      isHospitalAdmin: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    staffId?: string
    hospitalId: string
    isHospitalAdmin: boolean
  }
}
