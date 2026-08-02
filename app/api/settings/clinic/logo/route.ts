import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { buildStorageKey, getStorage } from '@/lib/storage'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

// A logo lives at `{hospitalId}/logo{ext}`, and the extension is derived from
// the validated MIME type rather than the uploaded filename. That is a small
// hardening — the filename is attacker-controlled and need not agree with the
// content type — but mainly it keeps the set of keys a logo can occupy closed
// and known, which is what makes the sweep below possible.
//
// Replacing or deleting a logo used to `readdir` the hospital directory and
// unlink everything starting with "logo.". An object store has no directories
// to read, so instead we delete every key in the known set. Deletes are
// idempotent on both drivers, so the four that do not exist cost a round trip
// and nothing else — and a logo upload is a rare operation.
const LOGO_EXTENSIONS = ['.jpg', '.png', '.webp', '.gif', '.svg'] as const

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  }
  return map[mime] || '.png'
}

async function clearStoredLogos(hospitalId: string): Promise<void> {
  const storage = getStorage()
  await Promise.all(
    LOGO_EXTENSIONS.map((ext) => storage.delete(buildStorageKey(hospitalId, `logo${ext}`)))
  )
}

// POST — upload / replace hospital logo
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, GIF and SVG images are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 2 MB limit' }, { status: 400 })
    }

    // Remove any previous logo before writing the new one, so switching from
    // logo.png to logo.svg does not leave the old file being served.
    await clearStoredLogos(hospitalId)

    const ext = mimeToExt(file.type)
    const fileName = `logo${ext}`
    const key = buildStorageKey(hospitalId, fileName)
    const bytes = await file.arrayBuffer()
    await getStorage().put(key, Buffer.from(bytes), { contentType: file.type })

    const logoPath = `/api/uploads/${key}`

    // Persist in DB
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: { logo: logoPath },
    })

    return NextResponse.json({ success: true, logo: logoPath })
  } catch (err: any) {
    console.error('Logo upload error:', err)
    return NextResponse.json({ error: err.message || 'Failed to upload logo' }, { status: 500 })
  }
}

// DELETE — remove hospital logo
export async function DELETE() {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await clearStoredLogos(hospitalId)

    // Clear in DB
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: { logo: null },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Logo delete error:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete logo' }, { status: 500 })
  }
}
