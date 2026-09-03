import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const force = !!body.force;

    const db = getDb();
    const result = await seedDatabase(db, tenantId, force);
    
    // Broadcast if new data generated
    if (!result.alreadySeeded && typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'system:heartbeat',
        data: {
          type: 'seed_completed',
          records_created: result.count,
          message: `Synthetic database generated (${result.count} records)`
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: true, 
      count: result.count,
      alreadySeeded: result.alreadySeeded,
      message: result.alreadySeeded ? 'Database already seeded with synthetic data' : `Generated ${result.count} synthetic records`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}