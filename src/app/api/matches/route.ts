import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TENANT_ID = 'tenant_demo_001';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const decision = searchParams.get('decision');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getDb();
    
    // Get latest run
    const lastRunRes = await db.query(
      'SELECT id FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1', [TENANT_ID]
    );
    const lastRun = lastRunRes.rows[0];

    if (!lastRun) return NextResponse.json({ candidates: [] });

    let query = `
      SELECT mc.*, 
        s.amount_minor as source_amount, s.method as source_method, s.event_time as source_time, s.type as source_type,
        t.amount_minor as target_amount, t.method as target_method, t.event_time as target_time, t.type as target_type
      FROM match_candidates mc
      LEFT JOIN canonical_transactions s ON mc.source_id = s.id
      LEFT JOIN canonical_transactions t ON mc.target_id = t.id
      WHERE mc.recon_run_id = $1
    `;
    const params: any[] = [lastRun.id];

    if (decision) {
      query += ` AND mc.decision = $2`;
      params.push(decision);
    }

    query += ` ORDER BY mc.confidence DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const candidates = (await db.query(query, params)).rows;

    return NextResponse.json({ candidates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
