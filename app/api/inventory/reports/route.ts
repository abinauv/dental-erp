import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET - Generate inventory reports
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get('type') || 'summary';

    switch (reportType) {
      case 'summary':
        return await getInventorySummary(hospitalId);
      case 'low_stock':
        return await getLowStockReport(hospitalId);
      case 'expiring':
        return await getExpiringItemsReport(hospitalId, searchParams);
      case 'stock_valuation':
        return await getStockValuationReport(hospitalId);
      case 'dead_stock':
        return await getDeadStockReport(hospitalId, searchParams);
      case 'movement':
        return await getStockMovementReport(hospitalId, searchParams);
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error generating inventory report:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory report', details: error.message },
      { status: 500 }
    );
  }
}

// Inventory Summary Report
async function getInventorySummary(hospitalId: string) {
  const [summary] = await pool.execute<RowDataPacket[]>(`
    SELECT
      COUNT(*) as total_items,
      SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_items,
      SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_items,
      SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock THEN 1 ELSE 0 END) as low_stock_items,
      SUM(current_stock * unit_price) as total_inventory_value,
      (SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL AND status = 'active' AND hospital_id = ?) as active_suppliers,
      (SELECT COUNT(*) FROM stock_alerts sa
       INNER JOIN inventory_items ii ON sa.item_id = ii.id
       WHERE sa.is_acknowledged = FALSE AND ii.hospital_id = ?) as pending_alerts
    FROM inventory_items
    WHERE deleted_at IS NULL AND hospital_id = ?
  `, [hospitalId, hospitalId, hospitalId]);

  const [categoryBreakdown] = await pool.execute<RowDataPacket[]>(`
    SELECT
      c.name as category,
      COUNT(i.id) as item_count,
      SUM(i.current_stock * i.unit_price) as category_value
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    WHERE i.deleted_at IS NULL AND i.hospital_id = ?
    GROUP BY c.id, c.name
    ORDER BY category_value DESC
  `, [hospitalId]);

  const [typeBreakdown] = await pool.execute<RowDataPacket[]>(`
    SELECT
      item_type,
      COUNT(*) as item_count,
      SUM(current_stock * unit_price) as type_value
    FROM inventory_items
    WHERE deleted_at IS NULL AND hospital_id = ?
    GROUP BY item_type
    ORDER BY type_value DESC
  `, [hospitalId]);

  return NextResponse.json({
    success: true,
    data: {
      summary: summary[0],
      category_breakdown: categoryBreakdown,
      type_breakdown: typeBreakdown
    }
  });
}

// Low Stock Report
async function getLowStockReport(hospitalId: string) {
  const [lowStockItems] = await pool.execute<RowDataPacket[]>(`
    SELECT
      i.id,
      i.item_code,
      i.name,
      i.current_stock,
      i.minimum_stock,
      i.reorder_point,
      i.unit_of_measurement,
      i.unit_price,
      c.name as category_name,
      s.name as supplier_name,
      s.phone as supplier_phone,
      CASE
        WHEN i.current_stock <= 0 THEN 'out_of_stock'
        WHEN i.current_stock <= i.minimum_stock THEN 'critical'
        WHEN i.current_stock <= i.reorder_point THEN 'low'
        ELSE 'sufficient'
      END as urgency,
      (i.reorder_point - i.current_stock) as suggested_order_quantity
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    LEFT JOIN suppliers s ON i.preferred_supplier_id = s.id
    WHERE i.deleted_at IS NULL
      AND i.hospital_id = ?
      AND i.is_active = TRUE
      AND i.current_stock <= i.reorder_point
    ORDER BY
      CASE
        WHEN i.current_stock <= 0 THEN 1
        WHEN i.current_stock <= i.minimum_stock THEN 2
        ELSE 3
      END,
      i.name ASC
  `, [hospitalId]);

  return NextResponse.json({
    success: true,
    data: lowStockItems
  });
}

// Expiring Items Report
async function getExpiringItemsReport(hospitalId: string, searchParams: URLSearchParams) {
  const daysAhead = parseInt(searchParams.get('days') || '30');

  const [expiringItems] = await pool.execute<RowDataPacket[]>(`
    SELECT
      i.id,
      i.item_code,
      i.name,
      b.batch_number,
      b.expiry_date,
      b.remaining_quantity,
      i.unit_of_measurement,
      i.unit_price,
      (b.remaining_quantity * i.unit_price) as value_at_risk,
      DATEDIFF(b.expiry_date, CURDATE()) as days_to_expiry,
      CASE
        WHEN b.expiry_date < CURDATE() THEN 'expired'
        WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 7 THEN 'critical'
        WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 30 THEN 'warning'
        ELSE 'normal'
      END as urgency
    FROM inventory_batches b
    INNER JOIN inventory_items i ON b.item_id = i.id
    WHERE i.deleted_at IS NULL
      AND i.hospital_id = ?
      AND b.remaining_quantity > 0
      AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY b.expiry_date ASC
  `, [hospitalId, daysAhead]);

  const [summary] = await pool.execute<RowDataPacket[]>(`
    SELECT
      SUM(CASE WHEN b.expiry_date < CURDATE() THEN 1 ELSE 0 END) as expired_batches,
      SUM(CASE WHEN b.expiry_date < CURDATE() THEN b.remaining_quantity * i.unit_price ELSE 0 END) as expired_value,
      SUM(CASE WHEN DATEDIFF(b.expiry_date, CURDATE()) BETWEEN 0 AND ? THEN 1 ELSE 0 END) as expiring_soon_batches,
      SUM(CASE WHEN DATEDIFF(b.expiry_date, CURDATE()) BETWEEN 0 AND ? THEN b.remaining_quantity * i.unit_price ELSE 0 END) as expiring_soon_value
    FROM inventory_batches b
    INNER JOIN inventory_items i ON b.item_id = i.id
    WHERE i.deleted_at IS NULL AND i.hospital_id = ? AND b.remaining_quantity > 0
  `, [daysAhead, daysAhead, hospitalId]);

  return NextResponse.json({
    success: true,
    data: {
      summary: summary[0],
      items: expiringItems
    }
  });
}

// Stock Valuation Report
async function getStockValuationReport(hospitalId: string) {
  const [valuation] = await pool.execute<RowDataPacket[]>(`
    SELECT
      i.id,
      i.item_code,
      i.name,
      i.current_stock,
      i.unit_of_measurement,
      i.unit_price,
      (i.current_stock * i.unit_price) as stock_value,
      c.name as category_name,
      i.item_type
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    WHERE i.deleted_at IS NULL
      AND i.hospital_id = ?
      AND i.current_stock > 0
    ORDER BY stock_value DESC
  `, [hospitalId]);

  const [totals] = await pool.execute<RowDataPacket[]>(`
    SELECT
      SUM(current_stock * unit_price) as total_value,
      COUNT(*) as items_in_stock,
      AVG(current_stock * unit_price) as average_item_value
    FROM inventory_items
    WHERE deleted_at IS NULL AND hospital_id = ? AND current_stock > 0
  `, [hospitalId]);

  return NextResponse.json({
    success: true,
    data: {
      totals: totals[0],
      items: valuation
    }
  });
}

// Dead Stock Report (items with no movement in specified days)
async function getDeadStockReport(hospitalId: string, searchParams: URLSearchParams) {
  const days = parseInt(searchParams.get('days') || '90');

  const [deadStock] = await pool.execute<RowDataPacket[]>(`
    SELECT
      i.id,
      i.item_code,
      i.name,
      i.current_stock,
      i.unit_of_measurement,
      i.unit_price,
      (i.current_stock * i.unit_price) as locked_value,
      c.name as category_name,
      MAX(st.transaction_date) as last_transaction_date,
      DATEDIFF(CURDATE(), MAX(st.transaction_date)) as days_since_last_movement
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    LEFT JOIN stock_transactions st ON i.id = st.item_id
    WHERE i.deleted_at IS NULL
      AND i.hospital_id = ?
      AND i.current_stock > 0
    GROUP BY i.id
    HAVING last_transaction_date IS NULL
        OR DATEDIFF(CURDATE(), MAX(st.transaction_date)) > ?
    ORDER BY locked_value DESC
  `, [hospitalId, days]);

  return NextResponse.json({
    success: true,
    data: deadStock
  });
}

// Stock Movement Report
async function getStockMovementReport(hospitalId: string, searchParams: URLSearchParams) {
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Start date and end date are required for movement report' },
      { status: 400 }
    );
  }

  const [movement] = await pool.execute<RowDataPacket[]>(`
    SELECT
      i.id,
      i.item_code,
      i.name,
      SUM(CASE WHEN st.transaction_type IN ('purchase', 'adjustment', 'opening_stock') THEN st.quantity ELSE 0 END) as total_in,
      SUM(CASE WHEN st.transaction_type IN ('sale', 'usage', 'wastage', 'return') THEN st.quantity ELSE 0 END) as total_out,
      COUNT(st.id) as transaction_count,
      i.current_stock,
      i.unit_of_measurement
    FROM inventory_items i
    LEFT JOIN stock_transactions st ON i.id = st.item_id
      AND st.transaction_date BETWEEN ? AND ?
    WHERE i.deleted_at IS NULL AND i.hospital_id = ?
    GROUP BY i.id
    HAVING transaction_count > 0
    ORDER BY transaction_count DESC
  `, [startDate, endDate, hospitalId]);

  return NextResponse.json({
    success: true,
    data: movement
  });
}
