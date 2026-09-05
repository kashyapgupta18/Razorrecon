import { NextResponse } from 'next/server';
import { generateBenchmarkReport } from '@/lib/reconciliation-engine';
import { getTenantId } from '@/lib/auth-server';
import { getDb } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

export async function POST() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Use a dedicated benchmark tenant to isolate from user's custom data
    const benchmarkTenantId = `benchmark_${tenantId}`;
    const db = getDb();
    
    // Force seed the exact ground truth synthetic data into the benchmark tenant
    await seedDatabase(db, benchmarkTenantId, true);

    const report = await generateBenchmarkReport(benchmarkTenantId);
    return NextResponse.json({ report, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
