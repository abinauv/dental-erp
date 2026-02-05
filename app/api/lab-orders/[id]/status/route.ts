import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// PATCH - Update lab order status
export async function PATCH(
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
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Valid statuses
    const validStatuses = [
      'created',
      'sent_to_lab',
      'in_progress',
      'quality_check',
      'ready',
      'delivered',
      'fitted',
      'remake_required',
      'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Get current order and verify it belongs to this hospital
    const [orders] = await pool.execute<RowDataPacket[]>(
      'SELECT status, sent_date, received_date, delivered_date FROM lab_orders WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Lab order not found' },
        { status: 404 }
      );
    }

    const currentStatus = orders[0].status;

    // Update dates based on status
    const dateUpdates: any = {};
    if (status === 'sent_to_lab' && !orders[0].sent_date) {
      dateUpdates.sent_date = 'CURDATE()';
    }
    if (status === 'ready' && !orders[0].received_date) {
      dateUpdates.received_date = 'CURDATE()';
    }
    if (status === 'fitted' && !orders[0].delivered_date) {
      dateUpdates.delivered_date = 'CURDATE()';
    }

    // Build update query
    let updateQuery = 'UPDATE lab_orders SET status = ?';
    const updateParams: any[] = [status];

    if (dateUpdates.sent_date) {
      updateQuery += ', sent_date = CURDATE()';
    }
    if (dateUpdates.received_date) {
      updateQuery += ', received_date = CURDATE()';
    }
    if (dateUpdates.delivered_date) {
      updateQuery += ', delivered_date = CURDATE()';
    }

    updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND hospital_id = ?';
    updateParams.push(id, hospitalId);

    await pool.execute(updateQuery, updateParams);

    // Add to history
    await pool.execute(
      `INSERT INTO lab_order_history (lab_order_id, status_from, status_to, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, currentStatus, status, session?.user?.id, notes || `Status changed to ${status}`]
    );

    return NextResponse.json({
      success: true,
      message: 'Lab order status updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating lab order status:', error);
    return NextResponse.json(
      { error: 'Failed to update lab order status', details: error.message },
      { status: 500 }
    );
  }
}
