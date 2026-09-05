import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';
import { runReconciliation } from '@/lib/reconciliation-engine';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    
    // Support { data: [...], mode: 'merge'|'replace' } or just [...]
    let records: any[];
    let mode = 'merge'; // Default to merge

    if (Array.isArray(body)) {
      records = body;
    } else if (body.data && Array.isArray(body.data)) {
      records = body.data;
      mode = body.mode || 'merge';
    } else {
      return NextResponse.json({ error: 'Payload must be a JSON array of transactions, or { data: [...], mode: "merge"|"replace" }' }, { status: 400 });
    }

    const db = getDb();
    const client = await db.connect();
    let count = 0;

    try {
      await client.query('BEGIN');

      // Only wipe existing data in 'replace' mode
      if (mode === 'replace') {
        await client.query('DELETE FROM match_candidates WHERE recon_run_id IN (SELECT id FROM recon_runs WHERE tenant_id = $1)', [tenantId]);
        await client.query('DELETE FROM exceptions WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM recon_runs WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM audit_events WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM health_scores WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM anomaly_signals WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM bank_entries WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM settlement_batches WHERE tenant_id = $1', [tenantId]);
      }

      const now = new Date().toISOString();

      for (const rec of records) {
        // Fallback for missing ids
        const id = rec.id || `txn_${uuidv4().slice(0, 12)}`;
        const amount_minor = Number(rec.amount_minor) || (rec.amount ? Math.round(Number(rec.amount) * 100) : 0);
        const type = rec.type || 'payment';
        const status = rec.status || 'captured';
        
        await client.query(`INSERT INTO canonical_transactions 
          (id, tenant_id, source, type, amount_minor, currency, fee_minor, tax_minor, net_minor,
           payment_id, order_id, refund_id, settlement_id, utr, method, status,
           event_time, settlement_time, counterparty, description, raw_payload_hash, created_at) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            id, tenantId, rec.source || 'custom_upload', type, amount_minor, rec.currency || 'INR',
            Number(rec.fee_minor) || 0, Number(rec.tax_minor) || 0, Number(rec.net_minor) || amount_minor, 
            rec.payment_id || null, rec.order_id || null, rec.refund_id || null,
            rec.settlement_id || null, rec.utr || null, rec.method || 'card', status, 
            rec.event_time || rec.date || now, rec.settlement_time || null,
            rec.counterparty || rec.merchant || 'Unknown', rec.description || 'Custom Uploaded Record', 
            uuidv4(), now
          ]);
        count++;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Automatically run reconciliation
    const reconResult = await runReconciliation(tenantId);
    
    // Broadcast if new data generated
    if (typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'system:heartbeat',
        data: {
          type: 'seed_completed',
          records_created: count,
          message: `Custom database uploaded (${count} records)`
        },
        timestamp: new Date().toISOString()
      });
      
      (globalThis as any).__wsBroadcast({
        channel: 'recon:completed',
        data: {
          runId: reconResult.runId,
          matchRate: reconResult.matchRate,
          matched: reconResult.matched,
          unmatched: reconResult.unmatched,
          precision: reconResult.precision,
          recall: reconResult.recall,
          f1Score: reconResult.f1Score,
          newExceptions: reconResult.exceptions?.length || 0,
          totalRecords: reconResult.totalRecords
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: true, 
      count,
      message: `Successfully uploaded and processed ${count} custom records. Reconciliation match rate: ${reconResult.matchRate.toFixed(1)}%`
    });
  } catch (error: any) {
    console.error('Custom seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
