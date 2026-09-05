import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getDb();

    let query = 'SELECT * FROM canonical_transactions WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (type) {
      query += ` AND type = $${params.length + 1}`;
      params.push(type);
    }
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const txns = (await db.query(query, params)).rows;

    return NextResponse.json({ transactions: txns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
