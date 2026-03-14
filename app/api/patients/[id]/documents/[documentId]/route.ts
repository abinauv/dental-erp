import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// GET /api/patients/[id]/documents/[documentId] - Get/download a specific document
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, documentId } = await params;

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        patientId: id,
        hospitalId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download') === 'true';

    // If just requesting metadata, return the document info
    if (!download) {
      return NextResponse.json({
        success: true,
        document,
      });
    }

    // If download requested, serve the file
    const filePath = path.join(process.cwd(), document.filePath);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.fileType,
        'Content-Disposition': `attachment; filename="${document.originalName}"`,
        'Content-Length': document.fileSize.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PATCH /api/patients/[id]/documents/[documentId] - Update document metadata
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, documentId } = await params;

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        patientId: id,
        hospitalId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { description, documentType, treatmentId } = body;

    const updateData: any = {};

    if (description !== undefined) {
      updateData.description = description;
    }

    if (documentType) {
      updateData.documentType = documentType;
    }

    if (treatmentId !== undefined) {
      updateData.treatmentId = treatmentId || null;
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update document' },
      { status: 500 }
    );
  }
}

// DELETE /api/patients/[id]/documents/[documentId] - Delete a document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, documentId } = await params;

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        patientId: id,
        hospitalId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Delete file from disk
      const filePath = path.join(process.cwd(), document.filePath);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }

      // Delete from database
      await prisma.document.delete({
        where: { id: documentId },
      });

      return NextResponse.json({
        success: true,
        message: 'Document permanently deleted',
      });
    } else {
      // Soft delete (archive)
      await prisma.document.update({
        where: { id: documentId },
        data: { isArchived: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Document archived',
      });
    }
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
