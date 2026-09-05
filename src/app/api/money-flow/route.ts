import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTenantId } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const payments = (await db.query("SELECT * FROM canonical_transactions WHERE tenant_id = $1 AND type = 'payment'", [tenantId])).rows;
    const refunds = (await db.query("SELECT * FROM canonical_transactions WHERE tenant_id = $1 AND type = 'refund'", [tenantId])).rows;
    const settlements = (await db.query("SELECT * FROM canonical_transactions WHERE tenant_id = $1 AND type = 'settlement'", [tenantId])).rows;

    let totalGross = 0;
    let totalFees = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalRefunds = 0;
    let totalSettled = 0;

    for (const p of payments) {
      totalGross += Number(p.amount_minor);
      totalFees += Number(p.fee_minor);
      totalTax += Number(p.tax_minor);
      totalNet += Number(p.net_minor);
    }
    for (const r of refunds) totalRefunds += Math.abs(Number(r.amount_minor));
    for (const s of settlements) totalSettled += Number(s.amount_minor);

    const nodes = [
      { id: 'Customer Payments', group: 'source' },
      { id: 'Gross Volume', group: 'gateway' },
      { id: 'MDR Fees', group: 'deduction' },
      { id: 'GST on Fees', group: 'deduction' },
      { id: 'Net Processing', group: 'gateway' },
      { id: 'Refunds', group: 'exception' },
      { id: 'Settled to Bank', group: 'settlement' },
      { id: 'Pending Settlement', group: 'destination' }
    ];

    const pending = Math.max(0, totalNet - totalRefunds - totalSettled);

    const links = [
      { source: 'Customer Payments', target: 'Gross Volume', value: totalGross },
      { source: 'Gross Volume', target: 'MDR Fees', value: totalFees },
      { source: 'Gross Volume', target: 'GST on Fees', value: totalTax },
      { source: 'Gross Volume', target: 'Net Processing', value: totalNet },
      { source: 'Net Processing', target: 'Refunds', value: totalRefunds },
      { source: 'Net Processing', target: 'Settled to Bank', value: totalSettled },
      { source: 'Net Processing', target: 'Pending Settlement', value: pending > 0 ? pending : 0 }
    ].filter(l => l.value > 0);

    return NextResponse.json({ nodes, links });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
