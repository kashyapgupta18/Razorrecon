import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    
    const db = getDb();
    
    let query = `
      SELECT e.*, ct.payment_id, ct.method, ct.counterparty
      FROM exceptions e
      LEFT JOIN canonical_transactions ct ON e.transaction_id = ct.id
      WHERE e.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND e.status = $2`;
      params.push(status);
    }

    query += ' ORDER BY e.created_at DESC LIMIT 100';

    const exceptions = (await db.query(query, params)).rows;
    return NextResponse.json({ exceptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
