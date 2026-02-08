import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// GET — list medications with search, category filter, pagination
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sp = request.nextUrl.searchParams
    const search = sp.get('search') || ''
    const category = sp.get('category') || ''
    const active = sp.get('active') // 'true' | 'false' | null (all)
    const page = parseInt(sp.get('page') || '1')
    const limit = parseInt(sp.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (active === 'true') where.isActive = true
    else if (active === 'false') where.isActive = false

    const [medications, total] = await Promise.all([
      prisma.medication.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.medication.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: medications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err: any) {
    console.error('Error fetching medications:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch medications' }, { status: 500 })
  }
}

// POST — create a medication
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, genericName, category, form, strength, manufacturer, defaultDosage, defaultFrequency, defaultDuration, contraindications, sideEffects } = body

    if (!name) {
      return NextResponse.json({ error: 'Medication name is required' }, { status: 400 })
    }

    const medication = await prisma.medication.create({
      data: {
        hospitalId,
        name,
        genericName: genericName || null,
        category: category || null,
        form: form || null,
        strength: strength || null,
        manufacturer: manufacturer || null,
        defaultDosage: defaultDosage || null,
        defaultFrequency: defaultFrequency || null,
        defaultDuration: defaultDuration || null,
        contraindications: contraindications || null,
        sideEffects: sideEffects || null,
      },
    })

    return NextResponse.json({ success: true, data: medication }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating medication:', err)
    return NextResponse.json({ error: err.message || 'Failed to create medication' }, { status: 500 })
  }
}
