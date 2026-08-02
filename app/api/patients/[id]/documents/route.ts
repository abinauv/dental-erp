import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import path from 'path'
import { randomUUID } from 'crypto'
import { buildStorageKey, getStorage } from '@/lib/storage'

// GET /api/patients/[id]/documents - Get all documents for a patient
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Verify patient exists and belongs to this hospital
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const documentType = searchParams.get('type')
    const treatmentId = searchParams.get('treatmentId')

    const where: any = {
      patientId: id,
      hospitalId,
      isArchived: false,
    }

    if (documentType) {
      where.documentType = documentType
    }

    if (treatmentId) {
      where.treatmentId = treatmentId
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        treatment: {
          select: {
            id: true,
            procedureNotes: true,
            procedure: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      documents,
    })
  } catch (error: any) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST /api/patients/[id]/documents - Upload a document
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, user } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Verify patient exists and belongs to this hospital
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('documentType') as string
    const description = formData.get('description') as string | null
    const treatmentId = formData.get('treatmentId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Stored name is a UUID, so nothing attacker-controlled reaches the key.
    // The extension is kept for content-type sniffing on the way back out and
    // is reduced to a safe character set first.
    const ext = path
      .extname(file.name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '')
    const fileName = `${randomUUID()}${ext}`

    // Tenant-prefixed storage key. Whether this lands on local disk or in a
    // bucket is the driver's business, not this route's.
    const key = buildStorageKey(hospitalId, 'documents', id, fileName)

    const bytes = await file.arrayBuffer()
    await getStorage().put(key, Buffer.from(bytes), { contentType: file.type })

    // Create document record. If this fails the bytes are already stored, so
    // drop them again — otherwise the file survives with no row pointing at
    // it: invisible in the UI, impossible to delete through it, and still
    // occupying storage. An invalid documentType is enough to trigger it.
    let document
    try {
      document = await prisma.document.create({
        data: {
          patientId: id,
          hospitalId,
          treatmentId: treatmentId || null,
          fileName,
          originalName: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: key,
          documentType: documentType as any,
          description: description || null,
          uploadedBy: user?.id,
        },
      })
    } catch (err) {
      // Swallow a failure here: the original error is what the caller needs.
      await getStorage()
        .delete(key)
        .catch(() => {})
      throw err
    }

    return NextResponse.json({
      success: true,
      document,
    })
  } catch (error: any) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload document' },
      { status: 500 }
    )
  }
}
