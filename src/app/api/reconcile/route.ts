import { NextResponse } from 'next/server';
import { runReconciliation } from '@/lib/reconciliation-engine';

const TENANT_ID = 'tenant_demo_001';

export async function POST() {
  try {
    const result = await runReconciliation(TENANT_ID);

    // Broadcast over WS
    if (typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'recon:completed',
        data: {
          runId: result.runId,
          matchRate: result.matchRate,
          matched: result.matched,
          unmatched: result.unmatched,
          duplicates: result.duplicates,
          precision: result.precision,
          recall: result.recall,
          f1Score: result.f1Score,
          avgLatencyMs: result.avgLatencyMs,
          p95LatencyMs: result.p95LatencyMs,
          newExceptions: result.exceptions?.length || 0,
          totalRecords: result.totalRecords
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}