import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM match_candidates WHERE recon_run_id IN (SELECT id FROM recon_runs WHERE tenant_id = $1)', [tenantId]);
      await client.query('DELETE FROM exceptions WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM recon_runs WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM audit_events WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM health_scores WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM anomaly_signals WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM bank_entries WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM settlement_batches WHERE tenant_id = $1', [tenantId]);
      await client.query('COMMIT');
      
      return NextResponse.json({ success: true, message: 'All data cleared successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error('Clear data error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
