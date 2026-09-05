import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';
import { runReconciliation } from '@/lib/reconciliation-engine';
import { v4 as uuidv4 } from 'uuid';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ParsedRecord {
  id?: string;
  source?: string;
  type?: string;
  amount_minor?: number;
  amount?: number; // rupees — converted to minor
  currency?: string;
  fee_minor?: number;
  tax_minor?: number;
  net_minor?: number;
  payment_id?: string;
  order_id?: string;
  refund_id?: string;
  settlement_id?: string;
  utr?: string;
  method?: string;
  status?: string;
  event_time?: string;
  date?: string; // alias for event_time
  settlement_time?: string;
  counterparty?: string;
  merchant?: string; // alias for counterparty
  description?: string;
  [key: string]: unknown;
}

function parseCSV(csvText: string): ParsedRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header — handle quoted headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => 
    h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  );

  const records: ParsedRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const record: ParsedRecord = {};
    
    headers.forEach((header, idx) => {
      if (idx < values.length) {
        record[header] = values[idx]?.trim() || '';
      }
    });
    
    records.push(record);
  }
  
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizeRecord(raw: ParsedRecord): {
  id: string; source: string; type: string; amount_minor: number; currency: string;
  fee_minor: number; tax_minor: number; net_minor: number;
  payment_id: string | null; order_id: string | null; refund_id: string | null;
  settlement_id: string | null; utr: string | null; method: string; status: string;
  event_time: string; settlement_time: string | null;
  counterparty: string; description: string;
} {
  const now = new Date().toISOString();
  
  // Amount: support both amount_minor (paise) and amount (rupees)
  let amount_minor = 0;
  if (raw.amount_minor) {
    amount_minor = Math.round(Number(raw.amount_minor));
  } else if (raw.amount) {
    amount_minor = Math.round(Number(raw.amount) * 100);
  }

  const fee_minor = Math.round(Number(raw.fee_minor) || 0);
  const tax_minor = Math.round(Number(raw.tax_minor) || 0);
  const net_minor = raw.net_minor ? Math.round(Number(raw.net_minor)) : (amount_minor - fee_minor - tax_minor);

  return {
    id: raw.id || `txn_${uuidv4().slice(0, 12)}`,
    source: String(raw.source || 'user_upload'),
    type: String(raw.type || 'payment'),
    amount_minor,
    currency: String(raw.currency || 'INR').toUpperCase(),
    fee_minor,
    tax_minor,
    net_minor,
    payment_id: raw.payment_id ? String(raw.payment_id) : null,
    order_id: raw.order_id ? String(raw.order_id) : null,
    refund_id: raw.refund_id ? String(raw.refund_id) : null,
    settlement_id: raw.settlement_id ? String(raw.settlement_id) : null,
    utr: raw.utr ? String(raw.utr) : null,
    method: String(raw.method || 'card'),
    status: String(raw.status || 'captured'),
    event_time: String(raw.event_time || raw.date || now),
    settlement_time: raw.settlement_time ? String(raw.settlement_time) : null,
    counterparty: String(raw.counterparty || raw.merchant || 'Unknown'),
    description: String(raw.description || 'User uploaded record'),
  };
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'merge'; // 'merge' or 'replace'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    const fileText = await file.text();
    const fileName = file.name.toLowerCase();

    // Parse based on file type
    let rawRecords: ParsedRecord[];
    
    if (fileName.endsWith('.csv')) {
      rawRecords = parseCSV(fileText);
    } else if (fileName.endsWith('.json')) {
      try {
        const parsed = JSON.parse(fileText);
        rawRecords = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a .csv or .json file.' }, { status: 400 });
    }

    if (rawRecords.length === 0) {
      return NextResponse.json({ error: 'File contains no records' }, { status: 400 });
    }

    if (rawRecords.length > 20000) {
      return NextResponse.json({ error: 'Too many records. Maximum is 20,000 per upload.' }, { status: 400 });
    }

    // Normalize all records
    const records = rawRecords.map(normalizeRecord);
    
    // Validate: at least some have amounts
    const validRecords = records.filter(r => r.amount_minor > 0);
    const skipped = records.length - validRecords.length;

    if (validRecords.length === 0) {
      return NextResponse.json({ 
        error: 'No valid records found. Ensure records have an "amount_minor" (paise) or "amount" (rupees) field with a positive value.' 
      }, { status: 400 });
    }

    const db = getDb();
    const client = await db.connect();
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      if (mode === 'replace') {
        // Wipe existing data for this tenant
        await client.query('DELETE FROM match_candidates WHERE recon_run_id IN (SELECT id FROM recon_runs WHERE tenant_id = $1)', [tenantId]);
        await client.query('DELETE FROM exceptions WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM recon_runs WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM audit_events WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM health_scores WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM anomaly_signals WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM bank_entries WHERE tenant_id = $1', [tenantId]);
        await client.query('DELETE FROM settlement_batches WHERE tenant_id = $1', [tenantId]);
      }

      const now = new Date().toISOString();

      for (const rec of validRecords) {
        await client.query(`INSERT INTO canonical_transactions 
          (id, tenant_id, source, type, amount_minor, currency, fee_minor, tax_minor, net_minor,
           payment_id, order_id, refund_id, settlement_id, utr, method, status,
           event_time, settlement_time, counterparty, description, raw_payload_hash, created_at) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            rec.id, tenantId, rec.source, rec.type, rec.amount_minor, rec.currency,
            rec.fee_minor, rec.tax_minor, rec.net_minor,
            rec.payment_id, rec.order_id, rec.refund_id,
            rec.settlement_id, rec.utr, rec.method, rec.status,
            rec.event_time, rec.settlement_time,
            rec.counterparty, rec.description,
            uuidv4(), now
          ]);
        insertedCount++;
      }

      // Audit event
      await client.query(`INSERT INTO audit_events (id, tenant_id, actor, action, entity_type, entity_id, details_json) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        `audit_${uuidv4().slice(0, 12)}`, tenantId, 'user', 'data_upload', 'upload', `upload_${Date.now()}`,
        JSON.stringify({ mode, fileName: file.name, totalRecords: rawRecords.length, inserted: insertedCount, skipped })
      ]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Run reconciliation on the combined dataset
    const reconResult = await runReconciliation(tenantId);

    // Broadcast via WebSocket
    if (typeof globalThis !== 'undefined' && (globalThis as any).__wsBroadcast) {
      (globalThis as any).__wsBroadcast({
        channel: 'system:heartbeat',
        data: {
          type: 'upload_completed',
          records_created: insertedCount,
          mode,
          message: `${mode === 'merge' ? 'Merged' : 'Uploaded'} ${insertedCount} records from ${file.name}`
        },
        timestamp: new Date().toISOString()
      });

      (globalThis as any).__wsBroadcast({
        channel: 'recon:completed',
        data: {
          runId: reconResult.runId,
          matchRate: reconResult.matchRate,
          matched: reconResult.matched,
          unmatched: reconResult.unmatched,
          precision: reconResult.precision,
          recall: reconResult.recall,
          f1Score: reconResult.f1Score,
          newExceptions: reconResult.exceptions?.length || 0,
          totalRecords: reconResult.totalRecords
        },
        timestamp: new Date().toISOString()
      });
    }

    // Count total records after upload
    const totalRes = await db.query('SELECT COUNT(*) as count FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
    const totalAfter = parseInt(totalRes.rows[0].count, 10) || 0;

    return NextResponse.json({
      success: true,
      upload: {
        inserted: insertedCount,
        skipped,
        totalRecordsInFile: rawRecords.length,
        mode,
        fileName: file.name
      },
      database: {
        totalRecords: totalAfter
      },
      reconciliation: {
        runId: reconResult.runId,
        matchRate: parseFloat(reconResult.matchRate.toFixed(1)),
        matched: reconResult.matched,
        unmatched: reconResult.unmatched,
        precision: parseFloat(reconResult.precision.toFixed(1)),
        recall: parseFloat(reconResult.recall.toFixed(1)),
        f1Score: parseFloat(reconResult.f1Score.toFixed(1)),
        exceptions: reconResult.exceptions?.length || 0
      },
      message: `Successfully ${mode === 'merge' ? 'merged' : 'uploaded'} ${insertedCount} records. Reconciliation: ${reconResult.matchRate.toFixed(1)}% match rate.`
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

// GET: Return sample template formats
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    csvTemplate: `type,amount,currency,payment_id,order_id,settlement_id,utr,method,status,event_time,counterparty,description
payment,5000,INR,pay_abc123,order_xyz789,setl_001,UTR123456,upi,captured,2024-01-15T10:30:00Z,Merchant Name,Monthly subscription
settlement,4880,INR,pay_abc123,,setl_001,UTR123456,neft,settled,2024-01-17T10:30:00Z,Merchant Name,Settlement payout
refund,1000,INR,pay_def456,order_mno321,,,card,refunded,2024-01-16T14:00:00Z,Another Merchant,Customer refund`,
    jsonTemplate: [
      {
        type: "payment",
        amount: 5000,
        currency: "INR",
        payment_id: "pay_abc123",
        order_id: "order_xyz789",
        settlement_id: "setl_001",
        utr: "UTR123456",
        method: "upi",
        status: "captured",
        event_time: "2024-01-15T10:30:00Z",
        counterparty: "Merchant Name",
        description: "Monthly subscription"
      },
      {
        type: "settlement",
        amount: 4880,
        currency: "INR",
        payment_id: "pay_abc123",
        settlement_id: "setl_001",
        utr: "UTR123456",
        method: "neft",
        status: "settled",
        event_time: "2024-01-17T10:30:00Z",
        counterparty: "Merchant Name",
        description: "Settlement payout"
      }
    ],
    fields: {
      required: ["amount (in rupees) OR amount_minor (in paise)"],
      recommended: ["type", "payment_id", "settlement_id", "utr", "method", "status", "event_time", "counterparty"],
      optional: ["order_id", "refund_id", "fee_minor", "tax_minor", "net_minor", "currency", "description", "source"]
    }
  });
}
