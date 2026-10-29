import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import { getStorage, toStorageKey } from '@/lib/storage'

// DELETE /api/staff/[id]/documents/[documentId] — remove a staff document
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id, documentId } = await params

    // Scope the lookup to this hospital AND this staff member, so one clinic can
    // never delete another's file and a document id can't be moved between staff.
    const document = await prisma.staffDocument.findFirst({
      where: { id: documentId, staffId: id, hospitalId },
    })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Remove the stored bytes first (idempotent), then the row. A failed storage
    // delete should not leave a dangling row the user can no longer act on.
    await getStorage()
      .delete(toStorageKey(document.filePath))
      .catch(() => {})
    await prisma.staffDocument.delete({ where: { id: documentId } })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error deleting staff document:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete document' }, { status: 500 })
  }
}
