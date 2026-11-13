import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

// GET - Fetch all categories
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    const categories = await prisma.inventoryCategory.findMany({
      where: { hospitalId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform the response to match expected format
    const categoriesWithCount = categories.map((category) => ({
      ...category,
      item_count: category._count.items,
    }))

    return NextResponse.json({
      success: true,
      data: categoriesWithCount,
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Error fetching categories:')
    return NextResponse.json(
      { error: await translateError('Failed to fetch categories'), details: error.message },
      { status: 500 }
    )
  }
}
