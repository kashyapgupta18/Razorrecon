import { NextResponse } from 'next/server';
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
}