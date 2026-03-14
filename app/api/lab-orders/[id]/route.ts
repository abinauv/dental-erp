import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch single lab order by ID
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

    const [orders] = await pool.execute<RowDataPacket[]>(
      `SELECT
        lo.*,
        lv.name as vendor_name,
        lv.phone as vendor_phone,
        lv.email as vendor_email,
        lv.address as vendor_address,
        lv.avg_turnaround_days,
        lv.quality_rating as vendor_rating,
        p.patient_id,
        p.first_name,
        p.last_name,
        p.phone as patient_phone,
        p.email as patient_email,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        u.name as created_by_name
      FROM lab_orders lo
      INNER JOIN lab_vendors lv ON lo.lab_vendor_id = lv.id
      INNER JOIN patients p ON lo.patient_id = p.id
      LEFT JOIN users u ON lo.created_by = u.id
      WHERE lo.id = ? AND lo.hospital_id = ? AND lo.deleted_at IS NULL`,
      [id, hospitalId]
    );

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Lab order not found' },
        { status: 404 }
      );
    }

    // Get order history
    const [history] = await pool.execute<RowDataPacket[]>(
      `SELECT h.*, u.name as changed_by_name
       FROM lab_order_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.lab_order_id = ?
       ORDER BY h.created_at DESC`,
      [id]
    );

    // Get documents
    const [documents] = await pool.execute<RowDataPacket[]>(
      `SELECT d.*, u.name as uploaded_by_name
       FROM lab_order_documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.lab_order_id = ?
       ORDER BY d.created_at DESC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...orders[0],
        history,
        documents
      }
    });
  } catch (error: any) {
    console.error('Error fetching lab order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab order', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update lab order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if order exists, belongs to this hospital and get current status
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT status FROM lab_orders WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Lab order not found' },
        { status: 404 }
      );
    }

    const currentStatus = existing[0].status;

    const {
      patient_id,
      lab_vendor_id,
      work_type,
      description,
      tooth_numbers,
      shade_guide,
      order_date,
      expected_date,
      sent_date,
      received_date,
      delivered_date,
      estimated_cost,
      actual_cost,
      status,
      quality_check_status,
      quality_notes,
      priority,
      notes,
      special_instructions
    } = body;

    // Validation
    if (!patient_id || !lab_vendor_id || !work_type || !order_date || !estimated_cost) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await pool.execute(
      `UPDATE lab_orders SET
        patient_id = ?, lab_vendor_id = ?, work_type = ?, description = ?,
        tooth_numbers = ?, shade_guide = ?, order_date = ?, expected_date = ?,
        sent_date = ?, received_date = ?, delivered_date = ?,
        estimated_cost = ?, actual_cost = ?, status = ?, quality_check_status = ?,
        quality_notes = ?, priority = ?, notes = ?, special_instructions = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND hospital_id = ?`,
      [
        patient_id, lab_vendor_id, work_type, description || null,
        tooth_numbers || null, shade_guide || null, order_date,
        expected_date || null, sent_date || null, received_date || null,
        delivered_date || null, estimated_cost, actual_cost || null,
        status, quality_check_status || 'pending', quality_notes || null,
        priority, notes || null, special_instructions || null, id, hospitalId
      ]
    );

    // If status changed, add to history
    if (status && status !== currentStatus) {
      await pool.execute(
        `INSERT INTO lab_order_history (lab_order_id, status_from, status_to, changed_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [id, currentStatus, status, session?.user?.id, `Status changed from ${currentStatus} to ${status}`]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lab order updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating lab order:', error);
    return NextResponse.json(
      { error: 'Failed to update lab order', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete lab order
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

    // Check if order exists and belongs to this hospital
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT status FROM lab_orders WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Lab order not found' },
        { status: 404 }
      );
    }

    // Check if order can be deleted (only allow deletion of orders in certain statuses)
    const status = existing[0].status;
    if (!['created', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Cannot delete lab order that is in progress. Please cancel it first.' },
        { status: 400 }
      );
    }

    // Soft delete
    await pool.execute(
      'UPDATE lab_orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND hospital_id = ?',
      [id, hospitalId]
    );

    return NextResponse.json({
      success: true,
      message: 'Lab order deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting lab order:', error);
    return NextResponse.json(
      { error: 'Failed to delete lab order', details: error.message },
      { status: 500 }
    );
  }
}
