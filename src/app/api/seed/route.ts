import { NextResponse } from 'next/server';
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