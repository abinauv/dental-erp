import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch single supplier with details
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

    const [suppliers] = await pool.execute<RowDataPacket[]>(
      `SELECT
        s.*,
        COUNT(DISTINCT i.id) as items_supplied,
        COUNT(DISTINCT po.id) as total_orders,
        COALESCE(SUM(CASE WHEN po.status = 'received' THEN po.total_amount ELSE 0 END), 0) as completed_business,
        COALESCE(SUM(CASE WHEN po.status IN ('sent', 'confirmed', 'partially_received') THEN po.total_amount ELSE 0 END), 0) as pending_business
      FROM suppliers s
      LEFT JOIN inventory_items i ON s.id = i.preferred_supplier_id AND i.deleted_at IS NULL
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
      WHERE s.id = ? AND s.hospital_id = ? AND s.deleted_at IS NULL
      GROUP BY s.id`,
      [id, hospitalId]
    );

    if (suppliers.length === 0) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get items supplied by this supplier
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT id, item_code, name, current_stock, unit_price
       FROM inventory_items
       WHERE preferred_supplier_id = ? AND hospital_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
      [id, hospitalId]
    );

    // Get recent purchase orders
    const [purchaseOrders] = await pool.execute<RowDataPacket[]>(
      `SELECT id, po_number, order_date, expected_delivery_date,
              total_amount, status, payment_status
       FROM purchase_orders
       WHERE supplier_id = ? AND deleted_at IS NULL
       ORDER BY order_date DESC
       LIMIT 10`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...suppliers[0],
        items_supplied_list: items,
        recent_purchase_orders: purchaseOrders
      }
    });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update supplier
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
    const {
      supplier_code,
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
      payment_terms,
      credit_limit,
      status,
      rating,
      notes
    } = body;

    // Check if supplier exists and belongs to this hospital
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM suppliers WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check if supplier_code is being changed and if it conflicts
    if (supplier_code && supplier_code !== existing[0].supplier_code) {
      const [duplicate] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM suppliers WHERE supplier_code = ? AND hospital_id = ? AND id != ? AND deleted_at IS NULL',
        [supplier_code, hospitalId, id]
      );

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Supplier code already exists' },
          { status: 409 }
        );
      }
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE suppliers SET
        supplier_code = COALESCE(?, supplier_code),
        name = COALESCE(?, name),
        contact_person = ?,
        email = ?,
        phone = COALESCE(?, phone),
        alternate_phone = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        gstin = ?,
        pan = ?,
        payment_terms = COALESCE(?, payment_terms),
        credit_limit = COALESCE(?, credit_limit),
        status = COALESCE(?, status),
        rating = COALESCE(?, rating),
        notes = ?
      WHERE id = ? AND hospital_id = ?`,
      [
        supplier_code, name, contact_person || null, email || null,
        phone, alternate_phone || null, address || null, city || null,
        state || null, pincode || null, gstin || null, pan || null,
        payment_terms, credit_limit, status, rating, notes || null,
        id, hospitalId
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Supplier updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete supplier
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

    // Check if supplier exists and belongs to this hospital
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM suppliers WHERE id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check if supplier has purchase orders
    const [purchaseOrders] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?',
      [id]
    );

    // Check if supplier is linked to items
    const [items] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM inventory_items WHERE preferred_supplier_id = ? AND hospital_id = ? AND deleted_at IS NULL',
      [id, hospitalId]
    );

    if (purchaseOrders[0].count > 0 || items[0].count > 0) {
      // Soft delete if has relationships
      await pool.execute(
        'UPDATE suppliers SET deleted_at = NOW(), status = ? WHERE id = ? AND hospital_id = ?',
        ['inactive', id, hospitalId]
      );
    } else {
      // Hard delete if no relationships
      await pool.execute('DELETE FROM suppliers WHERE id = ? AND hospital_id = ?', [id, hospitalId]);
    }

    return NextResponse.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier', details: error.message },
      { status: 500 }
    );
  }
}
