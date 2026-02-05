import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch stock transactions
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId');
    const transactionType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        st.*,
        i.name as item_name,
        i.item_code,
        u.name as performed_by_name,
        s.name as supplier_name,
        b.batch_number
      FROM stock_transactions st
      INNER JOIN inventory_items i ON st.item_id = i.id
      LEFT JOIN users u ON st.performed_by = u.id
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      LEFT JOIN inventory_batches b ON st.batch_id = b.id
      WHERE i.hospital_id = ?
    `;

    const params: any[] = [hospitalId];

    if (itemId) {
      query += ` AND st.item_id = ?`;
      params.push(itemId);
    }

    if (transactionType) {
      query += ` AND st.transaction_type = ?`;
      params.push(transactionType);
    }

    if (startDate) {
      query += ` AND st.transaction_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND st.transaction_date <= ?`;
      params.push(endDate);
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Add pagination
    query += ` ORDER BY st.transaction_date DESC, st.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [transactions] = await pool.execute<RowDataPacket[]>(query, params);

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching stock transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock transactions', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create stock transaction (adjustment, usage, wastage, etc.)
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connection = await pool.getConnection();

  try {
    const body = await request.json();
    const {
      transaction_type,
      item_id,
      batch_id,
      quantity,
      unit_price,
      transaction_date,
      reference_type,
      reference_id,
      from_location,
      to_location,
      supplier_id,
      notes
    } = body;

    // Validation
    if (!transaction_type || !item_id || !quantity || !transaction_date) {
      return NextResponse.json(
        { error: 'Missing required fields: transaction_type, item_id, quantity, transaction_date' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    // Get current item details (verify it belongs to this hospital)
    const [items] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM inventory_items WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL FOR UPDATE',
      [item_id, hospitalId]
    );

    if (items.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    const item = items[0];
    let newStock = parseFloat(item.current_stock);
    const transactionQuantity = parseFloat(quantity);

    // Calculate new stock based on transaction type
    switch (transaction_type) {
      case 'purchase':
      case 'adjustment':
      case 'opening_stock':
        newStock += transactionQuantity;
        break;
      case 'sale':
      case 'usage':
      case 'wastage':
      case 'return':
        newStock -= transactionQuantity;
        if (newStock < 0) {
          await connection.rollback();
          return NextResponse.json(
            { error: 'Insufficient stock for this transaction' },
            { status: 400 }
          );
        }
        break;
      default:
        await connection.rollback();
        return NextResponse.json(
          { error: 'Invalid transaction type' },
          { status: 400 }
        );
    }

    // Calculate total amount
    const transactionUnitPrice = unit_price || item.unit_price;
    const totalAmount = transactionQuantity * transactionUnitPrice;

    // Insert transaction
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO stock_transactions (
        transaction_type, item_id, batch_id, quantity, unit_price, total_amount,
        transaction_date, reference_type, reference_id, from_location, to_location,
        supplier_id, performed_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction_type, item_id, batch_id || null, quantity, transactionUnitPrice,
        totalAmount, transaction_date, reference_type || null, reference_id || null,
        from_location || null, to_location || null, supplier_id || null,
        session?.user?.id, notes || null
      ]
    );

    // Update item stock
    await connection.execute(
      'UPDATE inventory_items SET current_stock = ? WHERE id = ?',
      [newStock, item_id]
    );

    // Update batch quantity if batch_id is provided
    if (batch_id) {
      const batchQuantityChange = ['sale', 'usage', 'wastage', 'return'].includes(transaction_type)
        ? -transactionQuantity
        : transactionQuantity;

      await connection.execute(
        'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?',
        [batchQuantityChange, batch_id]
      );
    }

    // Create stock alert if necessary
    if (newStock <= item.minimum_stock) {
      const alertType = newStock <= 0 ? 'out_of_stock' : 'low_stock';

      // Check if alert already exists
      const [existingAlert] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM stock_alerts
         WHERE item_id = ? AND alert_type = ? AND is_acknowledged = FALSE`,
        [item_id, alertType]
      );

      if (existingAlert.length === 0) {
        await connection.execute(
          `INSERT INTO stock_alerts (item_id, alert_type, alert_date)
           VALUES (?, ?, CURDATE())`,
          [item_id, alertType]
        );
      }
    } else {
      // Remove low stock alerts if stock is now sufficient
      await connection.execute(
        `DELETE FROM stock_alerts
         WHERE item_id = ? AND alert_type IN ('low_stock', 'out_of_stock') AND is_acknowledged = FALSE`,
        [item_id]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertId,
        new_stock: newStock
      },
      message: 'Stock transaction recorded successfully'
    }, { status: 201 });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error creating stock transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create stock transaction', details: error.message },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
