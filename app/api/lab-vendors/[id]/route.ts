import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch single lab vendor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [vendors] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM lab_vendors WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL`,
      [id, hospitalId]
    );

    if (vendors.length === 0) {
      return NextResponse.json(
        { error: 'Lab vendor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vendors[0]
    });
  } catch (error: any) {
    console.error('Error fetching lab vendor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab vendor', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update lab vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if vendor exists and belongs to this hospital
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM lab_vendors WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Lab vendor not found' },
        { status: 404 }
      );
    }

    const {
      vendor_code,
      name,
      contact_person,
      email,
      phone,
      alternate_phone,
      address,
      city,
      state,
      pincode,
      gstin,
      pan,
      specializations,
      avg_turnaround_days,
      quality_rating,
      payment_terms,
      credit_limit,
      status,
      notes
    } = body;

    // Validation
    if (!vendor_code || !name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_code, name, phone' },
        { status: 400 }
      );
    }

    // Check if vendor_code is being changed and if it already exists for this hospital
    if (vendor_code) {
      const [duplicate] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM lab_vendors WHERE vendor_code = ? AND hospital_id = ? AND id != ? AND deleted_at IS NULL',
        [vendor_code, hospitalId, id]
      );

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Vendor code already exists' },
          { status: 409 }
        );
      }
    }

    await pool.execute(
      `UPDATE lab_vendors SET
        vendor_code = ?, name = ?, contact_person = ?, email = ?,
        phone = ?, alternate_phone = ?, address = ?, city = ?,
        state = ?, pincode = ?, gstin = ?, pan = ?, specializations = ?,
        avg_turnaround_days = ?, quality_rating = ?, payment_terms = ?,
        credit_limit = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND hospital_id = ?`,
      [
        vendor_code, name, contact_person || null, email || null,
        phone, alternate_phone || null, address || null, city || null,
        state || null, pincode || null, gstin || null, pan || null,
        specializations || null, avg_turnaround_days, quality_rating,
        payment_terms, credit_limit, status, notes || null, id, hospitalId
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Lab vendor updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating lab vendor:', error);
    return NextResponse.json(
      { error: 'Failed to update lab vendor', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete lab vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if vendor exists and belongs to this hospital
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM lab_vendors WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Lab vendor not found' },
        { status: 404 }
      );
    }

    // Check if vendor has any lab orders
    const [orders] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM lab_orders WHERE lab_vendor_id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );

    if (orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vendor with existing lab orders. Please inactive the vendor instead.' },
        { status: 400 }
      );
    }

    // Soft delete
    await pool.execute(
      'UPDATE lab_vendors SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND hospital_id = ?',
      [id, hospitalId]
    );

    return NextResponse.json({
      success: true,
      message: 'Lab vendor deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting lab vendor:', error);
    return NextResponse.json(
      { error: 'Failed to delete lab vendor', details: error.message },
      { status: 500 }
    );
  }
}
