import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TENANT_ID = 'tenant_demo_001';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    const txnStats = (await db.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN type='payment' THEN 1 ELSE 0 END) as payments,
        SUM(CASE WHEN type='settlement' THEN 1 ELSE 0 END) as settlements,
        SUM(CASE WHEN type='refund' THEN 1 ELSE 0 END) as refunds,
        SUM(amount_minor) as total_volume,
        AVG(amount_minor) as avg_amount
      FROM canonical_transactions WHERE tenant_id = $1
    `, [TENANT_ID])).rows[0] as Record<string, unknown>;

    const matchStats = (await db.query(`
      SELECT COUNT(*) as total_matches,
        SUM(CASE WHEN decision='auto_approved' THEN 1 ELSE 0 END) as auto_approved,
        SUM(CASE WHEN decision='pending' THEN 1 ELSE 0 END) as pending_review,
        AVG(confidence) as avg_confidence,
        AVG(processing_time_ms) as avg_latency
      FROM match_candidates
    `)).rows[0] as Record<string, unknown>;

    const excStats = (await db.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status='investigating' THEN 1 ELSE 0 END) as investigating,
        SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status='escalated' THEN 1 ELSE 0 END) as escalated,
        SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN status='open' THEN amount_minor ELSE 0 END) as open_exposure
      FROM exceptions WHERE tenant_id = $1
    `, [TENANT_ID])).rows[0] as Record<string, unknown>;

    const excByType = (await db.query(`
      SELECT type, COUNT(*) as count, SUM(amount_minor) as total_amount
      FROM exceptions WHERE tenant_id = $1
      GROUP BY type ORDER BY count DESC
    `, [TENANT_ID])).rows as Record<string, unknown>[];

    const lastRun = (await db.query(
      'SELECT * FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1', [TENANT_ID]
    )).rows[0] as Record<string, unknown>;

    const health = (await db.query(
      'SELECT * FROM health_scores WHERE tenant_id = $1 ORDER BY calculated_at DESC LIMIT 1', [TENANT_ID]
    )).rows[0] as Record<string, unknown>;

    const anomalies = (await db.query(
      'SELECT * FROM anomaly_signals WHERE tenant_id = $1 ORDER BY score DESC', [TENANT_ID]
    )).rows as Record<string, unknown>[];

    const recentAudit = (await db.query(
      'SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20', [TENANT_ID]
    )).rows as Record<string, unknown>[];

    // Generate trend data from recon runs
    const reconRuns = (await db.query(
      'SELECT * FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 30', [TENANT_ID]
    )).rows as Record<string, unknown>[];

    // Settlement delay calculation (Postgres specific)
    const settlementDelays = (await db.query(`
      SELECT AVG(
        EXTRACT(EPOCH FROM (CAST(settlement_time AS TIMESTAMP) - CAST(event_time AS TIMESTAMP))) / 3600
      ) as avg_delay_hours
      FROM canonical_transactions
      WHERE tenant_id = $1 AND settlement_time IS NOT NULL AND type = 'payment'
    `, [TENANT_ID])).rows[0] as Record<string, unknown>;

    // Method distribution
    const methodDist = (await db.query(`
      SELECT method, COUNT(*) as count, SUM(amount_minor) as volume
      FROM canonical_transactions WHERE tenant_id = $1 AND type = 'payment'
      GROUP BY method ORDER BY count DESC
    `, [TENANT_ID])).rows as Record<string, unknown>[];

    return NextResponse.json({
      transactions: {
        total: parseInt(txnStats?.total as string) || 0,
        payments: parseInt(txnStats?.payments as string) || 0,
        settlements: parseInt(txnStats?.settlements as string) || 0,
        refunds: parseInt(txnStats?.refunds as string) || 0,
        totalVolume: parseInt(txnStats?.total_volume as string) || 0,
        avgAmount: parseFloat(txnStats?.avg_amount as string) || 0,
      },
      matching: {
        totalMatches: parseInt(matchStats?.total_matches as string) || 0,
        autoApproved: parseInt(matchStats?.auto_approved as string) || 0,
        pendingReview: parseInt(matchStats?.pending_review as string) || 0,
        avgConfidence: parseFloat(matchStats?.avg_confidence as string) || 0,
        avgLatencyMs: parseFloat(matchStats?.avg_latency as string) || 0,
      },
      exceptions: {
        total: parseInt(excStats?.total as string) || 0,
        open: parseInt(excStats?.open_count as string) || 0,
        investigating: parseInt(excStats?.investigating as string) || 0,
        resolved: parseInt(excStats?.resolved as string) || 0,
        escalated: parseInt(excStats?.escalated as string) || 0,
        critical: parseInt(excStats?.critical as string) || 0,
        high: parseInt(excStats?.high as string) || 0,
        openExposure: parseInt(excStats?.open_exposure as string) || 0,
        byType: excByType,
      },
      lastRun: lastRun || null,
      healthScore: health || null,
      anomalies,
      recentActivity: recentAudit,
      reconHistory: reconRuns,
      avgSettlementDelayHours: parseFloat(settlementDelays?.avg_delay_hours as string) || 0,
      methodDistribution: methodDist,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
