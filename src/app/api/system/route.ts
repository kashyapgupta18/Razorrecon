import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import os from 'os';
import { getTenantId } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    
    const dbSizeRes = await db.query("SELECT pg_database_size(current_database()) as size");
    const dbSize = Number(dbSizeRes.rows[0].size) || 0;

    const rowCountRes = await db.query("SELECT SUM(n_live_tup) as total FROM pg_stat_user_tables");
    const totalRows = Number(rowCountRes.rows[0].total) || 0;

    const lastReconRun = (await db.query(
      'SELECT started_at, completed_at FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1', [tenantId]
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
}
