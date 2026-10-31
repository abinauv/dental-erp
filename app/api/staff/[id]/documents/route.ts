import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import path from 'path'
import { randomUUID } from 'crypto'
import { buildStorageKey, getStorage } from '@/lib/storage'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

async function verifyStaff(id: string, hospitalId: string) {
  return prisma.staff.findFirst({ where: { id, hospitalId }, select: { id: true } })
}

// GET /api/staff/[id]/documents — list a staff member's documents
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!(await verifyStaff(id, hospitalId))) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const documents = await prisma.staffDocument.findMany({
      where: { staffId: id, hospitalId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, documents })
  } catch (err: any) {
    logger.error({ err }, 'Error fetching staff documents:')
    return NextResponse.json({ error: err.message || 'Failed to fetch documents' }, { status: 500 })
  }
}

// POST /api/staff/[id]/documents — upload a document for a staff member
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Staff records are HR data; restrict uploads to admins.
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!(await verifyStaff(id, hospitalId))) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const documentType = (formData.get('documentType') as string | null) || null
    const description = (formData.get('description') as string | null) || null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX' },
        { status: 400 }
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Stored name is a UUID so nothing attacker-controlled reaches the key; the
    // extension is kept (reduced to a safe charset) for content-type on the way out.
    const ext = path
      .extname(file.name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '')
    const fileName = `${randomUUID()}${ext}`
    const key = buildStorageKey(hospitalId, 'staff', id, fileName)

    const bytes = await file.arrayBuffer()
    await getStorage().put(key, Buffer.from(bytes), { contentType: file.type })

    // If the row write fails the bytes are already stored — drop them so a file
    // never survives with no row pointing at it.
    let document
    try {
      document = await prisma.staffDocument.create({
        data: {
          staffId: id,
          hospitalId,
          fileName,
          originalName: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: key,
          documentType,
          description,
          uploadedBy: user?.id,
        },
      })
    } catch (err) {
      await getStorage()
        .delete(key)
        .catch(() => {})
      throw err
    }

    return NextResponse.json({ success: true, document })
  } catch (err: any) {
    logger.error({ err }, 'Error uploading staff document:')
    return NextResponse.json({ error: err.message || 'Failed to upload document' }, { status: 500 })
  }
}
