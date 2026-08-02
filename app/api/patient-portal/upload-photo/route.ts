import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePatientAuth } from '@/lib/patient-auth'
import path from 'path'
import { randomUUID } from 'crypto'
import { buildStorageKey, getStorage } from '@/lib/storage'

/**
 * POST /api/patient-portal/upload-photo
 * Patient uploads an intraoral/dental photo for triage.
 * Stores as a Document of type PHOTO, notifies doctor.
 */
export async function POST(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const description = formData.get('description') as string | null
    const category = formData.get('category') as string | null // e.g. "pain", "swelling", "bleeding", "other"

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, and WebP images are accepted' },
        { status: 400 }
      )
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    // Save file. This route already wrote a tenant-prefixed relative path, so
    // its stored value is unchanged by the storage refactor — what changed is
    // that the rest of the app now understands that shape. Downloading or
    // permanently deleting one of these previously failed, because both of
    // those paths assumed the `/uploads` prefix that only staff uploads had.
    const ext =
      path
        .extname(file.name)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, '') || '.jpg'
    const fileName = `${randomUUID()}${ext}`
    const key = buildStorageKey(patient!.hospitalId, 'patients', patient!.id, 'triage', fileName)

    await getStorage().put(key, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
    })

    // Create Document record
    const fullDescription = [category ? `Triage category: ${category}` : null, description]
      .filter(Boolean)
      .join(' — ')

    // On failure, drop the bytes again rather than leaving a file with no row
    // pointing at it — see the same guard in the staff upload route.
    let document
    try {
      document = await prisma.document.create({
        data: {
          hospitalId: patient!.hospitalId,
          patientId: patient!.id,
          fileName,
          originalName: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: key,
          documentType: 'PHOTO',
          description: fullDescription || 'Patient-uploaded triage photo',
          uploadedBy: `patient:${patient!.id}`,
        },
      })
    } catch (err) {
      await getStorage()
        .delete(key)
        .catch(() => {})
      throw err
    }

    // Notify doctor(s) — find any active doctor for the hospital
    const doctors = await prisma.user.findMany({
      where: {
        hospitalId: patient!.hospitalId,
        role: 'DOCTOR' as any,
        isActive: true,
      },
      select: { id: true },
      take: 3,
    })

    if (doctors.length > 0) {
      await prisma.notification.createMany({
        data: doctors.map((doc) => ({
          hospitalId: patient!.hospitalId,
          userId: doc.id,
          title: 'New Patient Photo for Triage',
          message: `${patient!.firstName} ${patient!.lastName} uploaded a photo${category ? ` (${category})` : ''}. ${description || 'Please review.'}`,
          type: 'GENERAL' as any,
          entityType: 'Document',
          entityId: document.id,
        })),
      })
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          fileName: document.originalName,
          description: document.description,
        },
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('Photo upload error:', err)
    return NextResponse.json({ error: err.message || 'Failed to upload photo' }, { status: 500 })
  }
}
