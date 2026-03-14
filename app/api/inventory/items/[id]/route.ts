import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch single inventory item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT
        i.*,
        c.name as category_name,
        s.name as supplier_name,
        s.phone as supplier_phone,
        s.email as supplier_email,
        CASE
          WHEN i.current_stock <= 0 THEN 'out_of_stock'
          WHEN i.current_stock <= i.minimum_stock THEN 'low_stock'
          WHEN i.current_stock <= i.reorder_point THEN 'reorder'
          ELSE 'sufficient'
        END as stock_status,
        (SELECT COUNT(*) FROM inventory_batches WHERE item_id = i.id) as batch_count,
        (SELECT SUM(quantity) FROM stock_transactions
         WHERE item_id = i.id AND transaction_type = 'purchase'
         AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as purchases_last_30_days,
        (SELECT SUM(quantity) FROM stock_transactions
         WHERE item_id = i.id AND transaction_type IN ('sale', 'usage')
         AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as usage_last_30_days
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN suppliers s ON i.preferred_supplier_id = s.id
      WHERE i.id = ? AND i.hospital_id = ? AND i.deleted_at IS NULL`,
      [id, hospitalId]
    );

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Get batches if batch tracking is enabled
    let batches: RowDataPacket[] = [];
    if (items[0].requires_batch_tracking) {
      const [batchData] = await pool.execute<RowDataPacket[]>(
        `SELECT b.*, s.name as supplier_name
         FROM inventory_batches b
         LEFT JOIN suppliers s ON b.supplier_id = s.id
         WHERE b.item_id = ?
         ORDER BY b.expiry_date ASC, b.received_date DESC`,
        [id]
      );
      batches = batchData;
    }

    // Get recent transactions
    const [transactions] = await pool.execute<RowDataPacket[]>(
      `SELECT
        st.*,
        u.name as performed_by_name,
        s.name as supplier_name
      FROM stock_transactions st
      LEFT JOIN users u ON st.performed_by = u.id
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      WHERE st.item_id = ?
      ORDER BY st.transaction_date DESC
      LIMIT 20`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...items[0],
        batches,
        recent_transactions: transactions
      }
    });
  } catch (error: any) {
    console.error('Error fetching inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory item', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      item_code,
      name,
      category_id,
      item_type,
      description,
      unit_of_measurement,
      minimum_stock,
      reorder_point,
      maximum_stock,
      unit_price,
      selling_price,
      hsn_code,
      tax_percentage,
      preferred_supplier_id,
      storage_location,
      requires_expiry_tracking,
      requires_batch_tracking,
      is_active,
      image_url,
      notes
    } = body;

    // Check if item exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM inventory_items WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Check if item_code is being changed and if it conflicts
    if (item_code && item_code !== existing[0].item_code) {
      const [duplicate] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM inventory_items WHERE item_code = ? AND id != ? AND hospital_id = ? AND deleted_at IS NULL',
        [item_code, id, hospitalId]
      );

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Item code already exists' },
          { status: 409 }
        );
      }
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE inventory_items SET
        item_code = COALESCE(?, item_code),
        name = COALESCE(?, name),
        category_id = ?,
        item_type = COALESCE(?, item_type),
        description = ?,
        unit_of_measurement = COALESCE(?, unit_of_measurement),
        minimum_stock = COALESCE(?, minimum_stock),
        reorder_point = COALESCE(?, reorder_point),
        maximum_stock = ?,
        unit_price = COALESCE(?, unit_price),
        selling_price = COALESCE(?, selling_price),
        hsn_code = ?,
        tax_percentage = COALESCE(?, tax_percentage),
        preferred_supplier_id = ?,
        storage_location = ?,
        requires_expiry_tracking = COALESCE(?, requires_expiry_tracking),
        requires_batch_tracking = COALESCE(?, requires_batch_tracking),
        is_active = COALESCE(?, is_active),
        image_url = ?,
        notes = ?
      WHERE id = ? AND hospital_id = ?`,
      [
        item_code, name, category_id || null, item_type, description || null,
        unit_of_measurement, minimum_stock, reorder_point, maximum_stock || null,
        unit_price, selling_price, hsn_code || null, tax_percentage,
        preferred_supplier_id || null, storage_location || null,
        requires_expiry_tracking, requires_batch_tracking, is_active,
        image_url || null, notes || null, id, hospitalId
      ]
    );

    // Check if stock alert needs to be created/updated
    const updatedMinStock = minimum_stock ?? existing[0].minimum_stock;
    const currentStock = existing[0].current_stock;

    if (currentStock <= updatedMinStock) {
      const alertType = currentStock <= 0 ? 'out_of_stock' : 'low_stock';

      // Check if alert already exists
      const [existingAlert] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM stock_alerts
         WHERE item_id = ? AND alert_type = ? AND is_acknowledged = FALSE`,
        [id, alertType]
      );

      if (existingAlert.length === 0) {
        await pool.execute(
          `INSERT INTO stock_alerts (item_id, alert_type, alert_date, hospital_id)
           VALUES (?, ?, CURDATE(), ?)`,
          [id, alertType, hospitalId]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory item', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete inventory item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if item exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM inventory_items WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Check if item has been used in transactions
    const [transactions] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM stock_transactions WHERE item_id = ?',
      [id]
    );

    if (transactions[0].count > 0) {
      // Soft delete if has transaction history
      await pool.execute(
        'UPDATE inventory_items SET deleted_at = NOW(), is_active = FALSE WHERE id = ? AND hospital_id = ?',
        [id, hospitalId]
      );
    } else {
      // Hard delete if no transaction history
      await pool.execute('DELETE FROM inventory_items WHERE id = ? AND hospital_id = ?', [id, hospitalId]);
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory item', details: error.message },
      { status: 500 }
    );
  }
}
