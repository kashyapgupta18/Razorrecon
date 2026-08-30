const fs = require('fs');
const path = require('path');

const routes = {
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\money-flow\\route.ts': `import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TENANT_ID = 'tenant_demo_001';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const payments = (await db.query("SELECT * FROM canonical_transactions WHERE tenant_id = $1 AND type = 'payment'", [TENANT_ID])).rows;
    const refunds = (await db.query("SELECT * FROM canonical_transactions WHERE tenant_id = $1 AND type = 'refund'", [TENANT_ID])).rows;
    const settlements = (await db.query("SELECT * FROM canonical_transactions WHERE tenant_id = $1 AND type = 'settlement'", [TENANT_ID])).rows;

    let totalGross = 0;
    let totalFees = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalRefunds = 0;
    let totalSettled = 0;

    for (const p of payments) {
      totalGross += Number(p.amount_minor);
      totalFees += Number(p.fee_minor);
      totalTax += Number(p.tax_minor);
      totalNet += Number(p.net_minor);
    }
    for (const r of refunds) totalRefunds += Math.abs(Number(r.amount_minor));
    for (const s of settlements) totalSettled += Number(s.amount_minor);

    const nodes = [
      { id: 'Customer Payments' },
      { id: 'Gross Volume' },
      { id: 'MDR Fees' },
      { id: 'GST on Fees' },
      { id: 'Net Processing' },
      { id: 'Refunds' },
      { id: 'Settled to Bank' },
      { id: 'Pending Settlement' }
    ];

    const pending = Math.max(0, totalNet - totalRefunds - totalSettled);

    const links = [
      { source: 'Customer Payments', target: 'Gross Volume', value: totalGross },
      { source: 'Gross Volume', target: 'MDR Fees', value: totalFees },
      { source: 'Gross Volume', target: 'GST on Fees', value: totalTax },
      { source: 'Gross Volume', target: 'Net Processing', value: totalNet },
      { source: 'Net Processing', target: 'Refunds', value: totalRefunds },
      { source: 'Net Processing', target: 'Settled to Bank', value: totalSettled },
      { source: 'Net Processing', target: 'Pending Settlement', value: pending > 0 ? pending : 0 }
    ].filter(l => l.value > 0);

    return NextResponse.json({ nodes, links });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`,
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\reconcile\\route.ts': `import { NextResponse } from 'next/server';
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
}`,
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\seed\\route.ts': `import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { getDb } from '@/lib/db';

export async function POST() {
  try {
    const db = getDb();
    const result = await seedDatabase(db);
    
    // Broadcast if new data generated
    if (!result.alreadySeeded && typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'system:heartbeat',
        data: {
          type: 'seed_completed',
          records_created: result.count,
          message: \`Synthetic database generated (\${result.count} records)\`
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: true, 
      count: result.count,
      alreadySeeded: result.alreadySeeded,
      message: result.alreadySeeded ? 'Database already seeded with synthetic data' : \`Generated \${result.count} synthetic records\`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`,
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\simulator\\route.ts': `import { NextResponse } from 'next/server';
import { startSimulator, stopSimulator, isSimulatorRunning, getSimulatorStats } from '@/lib/live-simulator';

export async function GET() {
  return NextResponse.json(getSimulatorStats());
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json();
    if (action === 'start') {
      startSimulator(3000);
      return NextResponse.json({ success: true, message: 'Simulator started' });
    } else if (action === 'stop') {
      stopSimulator();
      return NextResponse.json({ success: true, message: 'Simulator stopped' });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`,
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\system\\route.ts': `import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import os from 'os';

const TENANT_ID = 'tenant_demo_001';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    
    const dbSizeRes = await db.query("SELECT pg_database_size(current_database()) as size");
    const dbSize = Number(dbSizeRes.rows[0].size) || 0;

    const rowCountRes = await db.query("SELECT SUM(n_live_tup) as total FROM pg_stat_user_tables");
    const totalRows = Number(rowCountRes.rows[0].total) || 0;

    const lastReconRun = (await db.query(
      'SELECT started_at, completed_at FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1', [TENANT_ID]
    )).rows[0];

    const wsStats = typeof globalThis !== 'undefined' && (globalThis as any).__wsStats 
      ? (globalThis as any).__wsStats() 
      : { connectedClients: 0, uptime: process.uptime() };

    return NextResponse.json({
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      memoryUsage: {
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        freeMem: Math.round(os.freemem() / 1024 / 1024),
        totalMem: Math.round(os.totalmem() / 1024 / 1024),
        uptime: os.uptime(),
      },
      database: {
        type: 'postgresql',
        sizeBytes: dbSize,
        totalRows,
      },
      wsServer: wsStats,
      lastReconAt: lastReconRun ? lastReconRun.completed_at : null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`,
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\transactions\\route.ts': `import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TENANT_ID = 'tenant_demo_001';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getDb();

    let query = 'SELECT * FROM canonical_transactions WHERE tenant_id = $1';
    const params: any[] = [TENANT_ID];
    
    if (type) {
      query += \` AND type = \$\${params.length + 1}\`;
      params.push(type);
    }
    if (status) {
      query += \` AND status = \$\${params.length + 1}\`;
      params.push(status);
    }

    query += \` ORDER BY created_at DESC LIMIT \$\${params.length + 1}\`;
    params.push(limit);

    const txns = (await db.query(query, params)).rows;

    return NextResponse.json({ transactions: txns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`,
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\exceptions\\route.ts': `import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TENANT_ID = 'tenant_demo_001';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    
    const db = getDb();
    
    let query = \`
      SELECT e.*, ct.payment_id, ct.method, ct.counterparty
      FROM exceptions e
      LEFT JOIN canonical_transactions ct ON e.transaction_id = ct.id
      WHERE e.tenant_id = $1
    \`;
    const params: any[] = [TENANT_ID];

    if (status) {
      query += \` AND e.status = $2\`;
      params.push(status);
    }

    query += ' ORDER BY e.created_at DESC LIMIT 100';

    const exceptions = (await db.query(query, params)).rows;
    return NextResponse.json({ exceptions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`
};

for (const [file, code] of Object.entries(routes)) {
  fs.writeFileSync(file, code, 'utf8');
}
console.log('Fixed API routes');
