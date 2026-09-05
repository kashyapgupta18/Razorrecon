import { NextResponse } from 'next/server';
import { startSimulator, stopSimulator, isSimulatorRunning, getSimulatorStats } from '@/lib/live-simulator';
import { getTenantId } from '@/lib/auth-server';

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getSimulatorStats(tenantId));
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();
    if (action === 'start') {
      startSimulator(tenantId, 3000);
      return NextResponse.json({ success: true, message: 'Simulator started' });
    } else if (action === 'stop') {
      stopSimulator(tenantId);
      return NextResponse.json({ success: true, message: 'Simulator stopped' });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
