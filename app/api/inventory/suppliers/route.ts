import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch all suppliers
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        s.*,
        COUNT(DISTINCT i.id) as items_supplied,
        COUNT(DISTINCT po.id) as total_orders,
        COALESCE(SUM(po.total_amount), 0) as total_business
      FROM suppliers s
      LEFT JOIN inventory_items i ON s.id = i.preferred_supplier_id AND i.deleted_at IS NULL
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
      WHERE s.deleted_at IS NULL AND s.hospital_id = ?
    `;

    const params: any[] = [hospitalId];
    const searchPattern = `%${search}%`;

    if (search) {
      query += ` AND (s.name LIKE ? OR s.supplier_code LIKE ? OR s.contact_person LIKE ?)`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (status !== 'all') {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY s.id`;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM suppliers s
      WHERE s.deleted_at IS NULL AND s.hospital_id = ?
      ${search ? 'AND (s.name LIKE ? OR s.supplier_code LIKE ? OR s.contact_person LIKE ?)' : ''}
      ${status !== 'all' ? 'AND s.status = ?' : ''}
    `;
    const countParams: any[] = [hospitalId];
    if (search) countParams.push(searchPattern, searchPattern, searchPattern);
    if (status !== 'all') countParams.push(status);

    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0].total;

    // Add pagination
    query += ` ORDER BY s.name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [suppliers] = await pool.execute<RowDataPacket[]>(query, params);

    return NextResponse.json({
      success: true,
      data: suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new supplier
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
      payment_terms = 'Net 30',
      credit_limit = 0,
      status = 'active',
      rating = 0,
      notes
    } = body;

    // Validation
    if (!supplier_code || !name || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: supplier_code, name, phone' },
        { status: 400 }
      );
    }

    // Check if supplier_code already exists for this hospital
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM suppliers WHERE supplier_code = ? AND hospital_id = ? AND deleted_at IS NULL',
      [supplier_code, hospitalId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Supplier code already exists' },
        { status: 409 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO suppliers (
        hospital_id, supplier_code, name, contact_person, email, phone, alternate_phone,
        address, city, state, pincode, gstin, pan, payment_terms,
        credit_limit, status, rating, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hospitalId, supplier_code, name, contact_person || null, email || null,
        phone, alternate_phone || null, address || null, city || null,
        state || null, pincode || null, gstin || null, pan || null,
        payment_terms, credit_limit, status, rating, notes || null
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: result.insertId },
      message: 'Supplier created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier', details: error.message },
      { status: 500 }
    );
  }
}
