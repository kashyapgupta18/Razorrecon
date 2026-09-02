import { NextResponse } from 'next/server';
import { generateBenchmarkReport } from '@/lib/reconciliation-engine';
import { getTenantId } from '@/lib/auth-server';

export async function POST() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const report = await generateBenchmarkReport(tenantId);
    return NextResponse.json({ report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}