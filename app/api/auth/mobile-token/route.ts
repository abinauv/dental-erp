import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { SignJWT } from 'jose'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

// Brute-force throttle (11.3): this custom route is outside Better Auth's
// built-in rate limiter, so cap attempts per client IP + email.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 5 * 60 * 1000

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown'
}

// Mobile-specific login endpoint that returns a JWT token directly
// instead of setting cookies (which don't work well in native apps)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = loginSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 })
    }

    const { email, password } = validated.data

    const limit = rateLimit(`mobile-token:${clientIp(req)}:${email}`, MAX_ATTEMPTS, WINDOW_MS)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        staff: true,
        hospital: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.hospital || !user.hospital.isActive) {
      return NextResponse.json({ error: 'Your clinic account is inactive' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create JWT token using jose directly (avoids NextAuth encode() salt issues)
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      staffId: user.staff?.id,
      hospitalId: user.hospitalId,
      isHospitalAdmin: user.isHospitalAdmin,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalName: user.hospital.name,
        staffId: user.staff?.id,
        image: user.image,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Mobile auth error:')
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
