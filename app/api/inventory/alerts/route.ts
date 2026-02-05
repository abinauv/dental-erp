import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch stock alerts
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const acknowledged = searchParams.get('acknowledged') || 'false';
    const alertType = searchParams.get('type') || '';

    let query = `
      SELECT
        sa.*,
        i.item_code,
        i.name as item_name,
        i.current_stock,
        i.minimum_stock,
        i.unit_of_measurement,
        c.name as category_name,
        u.name as acknowledged_by_name
      FROM stock_alerts sa
      INNER JOIN inventory_items i ON sa.item_id = i.id
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN users u ON sa.acknowledged_by = u.id
      WHERE i.deleted_at IS NULL AND i.hospital_id = ?
    `;

    const params: any[] = [hospitalId];

    if (acknowledged === 'false') {
      query += ` AND sa.is_acknowledged = FALSE`;
    } else if (acknowledged === 'true') {
      query += ` AND sa.is_acknowledged = TRUE`;
    }

    if (alertType) {
      query += ` AND sa.alert_type = ?`;
      params.push(alertType);
    }

    query += ` ORDER BY sa.alert_date DESC, sa.created_at DESC`;

    const [alerts] = await pool.execute<RowDataPacket[]>(query, params);

    // Get summary counts for this hospital
    const [summary] = await pool.execute<RowDataPacket[]>(`
      SELECT
        COUNT(*) as total_alerts,
        SUM(CASE WHEN sa.alert_type = 'out_of_stock' THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN sa.alert_type = 'low_stock' THEN 1 ELSE 0 END) as low_stock,
        SUM(CASE WHEN sa.alert_type = 'expiring_soon' THEN 1 ELSE 0 END) as expiring_soon,
        SUM(CASE WHEN sa.alert_type = 'expired' THEN 1 ELSE 0 END) as expired
      FROM stock_alerts sa
      INNER JOIN inventory_items i ON sa.item_id = i.id
      WHERE sa.is_acknowledged = FALSE AND i.hospital_id = ?
    `, [hospitalId]);

    return NextResponse.json({
      success: true,
      data: alerts,
      summary: summary[0]
    });
  } catch (error: any) {
    console.error('Error fetching stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock alerts', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Acknowledge alert
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { alert_id, notes } = body;

    if (!alert_id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    // Verify alert belongs to this hospital
    const [alertCheck] = await pool.execute<RowDataPacket[]>(`
      SELECT sa.id FROM stock_alerts sa
      INNER JOIN inventory_items i ON sa.item_id = i.id
      WHERE sa.id = ? AND i.hospital_id = ?
    `, [alert_id, hospitalId]);

    if (alertCheck.length === 0) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE stock_alerts
       SET is_acknowledged = TRUE,
           acknowledged_by = ?,
           acknowledged_at = NOW(),
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [session?.user?.id, notes || null, alert_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge alert', details: error.message },
      { status: 500 }
    );
  }
}
