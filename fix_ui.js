const fs = require('fs');

// 1. types.ts
let types = fs.readFileSync('d:\\AI Finance\\razorrecon\\src\\lib\\types.ts', 'utf8');
types = types.replace(
  '  transaction?: CanonicalTransaction;\n  comments?: ExceptionComment[];\n}',
  '  transaction?: CanonicalTransaction;\n  comments?: ExceptionComment[];\n  payment_id?: string;\n  method?: string;\n  counterparty?: string;\n}'
);
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\lib\\types.ts', types);

// 2. exceptions/page.tsx (no longer needs changes if types are fixed, but maybe cast just in case)
let excPage = fs.readFileSync('d:\\AI Finance\\razorrecon\\src\\app\\exceptions\\page.tsx', 'utf8');
excPage = excPage.replace(/e\.txn_type/g, 'e.transaction?.type || "unknown"');
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\app\\exceptions\\page.tsx', excPage);

// 3. money-flow/page.tsx
let mfPage = fs.readFileSync('d:\\AI Finance\\razorrecon\\src\\app\\money-flow\\page.tsx', 'utf8');
mfPage = mfPage.replace('const links: SankeyLink<Record<string, unknown>, Record<string, unknown>>[] = rawData.links || [];', 'const links: any[] = rawData.links || [];');
mfPage = mfPage.replace('const nodes: SankeyNode<Record<string, unknown>, Record<string, unknown>>[] = rawData.nodes || [];', 'const nodes: any[] = rawData.nodes || [];');
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\app\\money-flow\\page.tsx', mfPage);

// 4. page.tsx (Dashboard UI)
let pageTsx = fs.readFileSync('d:\\AI Finance\\razorrecon\\src\\app\\page.tsx', 'utf8');
// Fix matchRate
pageTsx = pageTsx.replace(/data\.lastRun\?\.matchRate/g, '(data.lastRun as any)?.match_rate');
pageTsx = pageTsx.replace(/data\.lastRun\?\.status/g, '(data.lastRun as any)?.status');
pageTsx = pageTsx.replace(/data\.lastRun\?\.unmatched/g, '(data.lastRun as any)?.unmatched');
// Fix WebSocketEvent
pageTsx = pageTsx.replace(/export type WebSocketEvent = \{/g, 'export type WebSocketEvent = {\n  timestamp: string | number;');
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\app\\page.tsx', pageTsx);

// 5. reconciliation/page.tsx
let reconPage = fs.readFileSync('d:\\AI Finance\\razorrecon\\src\\app\\reconciliation\\page.tsx', 'utf8');
reconPage = reconPage.replace(/\{data\.lastRun\.match_rate\.toFixed\(1\)\}/g, '{(data.lastRun as any).match_rate.toFixed(1)}');
reconPage = reconPage.replace(/\{data\.lastRun\.precision\.toFixed\(1\)\}/g, '{(data.lastRun as any).precision.toFixed(1)}');
reconPage = reconPage.replace(/\{data\.lastRun\.recall\.toFixed\(1\)\}/g, '{(data.lastRun as any).recall.toFixed(1)}');
reconPage = reconPage.replace(/\{data\.lastRun\.avg_latency_ms\.toFixed\(0\)\}/g, '{(data.lastRun as any).avg_latency_ms.toFixed(0)}');
reconPage = reconPage.replace(/data\.lastRun\.status === 'completed'/g, '(data.lastRun as any).status === "completed"');
reconPage = reconPage.replace(/data\.lastRun\.total_records\.toLocaleString\(\)/g, '(data.lastRun as any).total_records.toLocaleString()');
reconPage = reconPage.replace(/data\.lastRun\.matched\.toLocaleString\(\)/g, '(data.lastRun as any).matched.toLocaleString()');
reconPage = reconPage.replace(/data\.lastRun\.unmatched\.toLocaleString\(\)/g, '(data.lastRun as any).unmatched.toLocaleString()');
reconPage = reconPage.replace(/data\.lastRun\.duplicates\.toLocaleString\(\)/g, '(data.lastRun as any).duplicates.toLocaleString()');
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\app\\reconciliation\\page.tsx', reconPage);

// 6. Fix ai-copilot and benchmark API routes
const apiAi = `import { NextResponse } from 'next/server';
import { processAIQuery } from '@/lib/ai-engine';

const TENANT_ID = 'tenant_demo_001';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

    const result = await processAIQuery(TENANT_ID, query);

    // Broadcast over WS
    if (typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'system:heartbeat',
        data: { type: 'ai_query', query_type: result.queryType, confidence: result.confidence },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`;
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\app\\api\\ai-copilot\\route.ts', apiAi);

const apiBench = `import { NextResponse } from 'next/server';
import { generateBenchmarkReport } from '@/lib/reconciliation-engine';

const TENANT_ID = 'tenant_demo_001';

export async function POST() {
  try {
    const report = await generateBenchmarkReport(TENANT_ID);
    return NextResponse.json({ report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`;
fs.writeFileSync('d:\\AI Finance\\razorrecon\\src\\app\\api\\benchmark\\route.ts', apiBench);

console.log('UI and Remaining API fixed');
