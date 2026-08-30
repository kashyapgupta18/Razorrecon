import { NextResponse } from 'next/server';
import { generateBenchmarkReport } from '@/lib/reconciliation-engine';

const TENANT_ID = 'tenant_demo_001';

export async function POST() {
  try {
    const report = await generateBenchmarkReport(TENANT_ID);
    return NextResponse.json({ report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}