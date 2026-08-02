import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import { getStorage, keyBelongsToHospital, StorageNotFoundError, toStorageKey } from '@/lib/storage';

// GET /api/uploads/[...path] - Serve uploaded files
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path: pathSegments } = await params;
    const requested = pathSegments.join('/');

    // Multi-tenant isolation: a storage key's first segment is the hospital
    // that owns the file, so this comparison is what keeps one clinic out of
    // another clinic's patient records.
    //
    // It runs before storage is touched and before the 404 below, deliberately.
    // Answering 404 for "exists but is not yours" and 403 for "not yours" in
    // the other order would turn this endpoint into an oracle for whether a
    // given file exists in some other clinic.
    //
    // keyBelongsToHospital also answers false for a malformed or traversing
    // key, so those land here as 403 rather than reaching the driver.
    if (!keyBelongsToHospital(requested, hospitalId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const object = await getStorage().get(toStorageKey(requested));

    return new NextResponse(new Uint8Array(object.body), {
      headers: {
        'Content-Type': object.contentType,
        'Content-Length': String(object.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    if (error instanceof StorageNotFoundError) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to serve file' },
      { status: 500 }
    );
  }
}
