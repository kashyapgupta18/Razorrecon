import { NextResponse } from 'next/server';
import { processAIQuery } from '@/lib/ai-engine';
import { getTenantId } from '@/lib/auth-server';

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

    const result = await processAIQuery(tenantId, query);

    // Broadcast over WS
    if (typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'system:heartbeat',
        data: { type: 'ai_query', query_type: result.queryType, confidence: result.confidence },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
