// ============================================================
// RazorRecon AI — Live Transaction Simulator
// Generates realistic transactions in real-time to simulate
// production webhook ingestion from Razorpay
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { eventBus } from './event-bus';
import { runReconciliation } from './reconciliation-engine';

const TENANT_ID = 'tenant_demo_001';
const MDR_RATE = 0.02;
const GST_ON_MDR = 0.18;

function genId(prefix: string) { return `${prefix}_${uuidv4().slice(0, 12)}`; }
function paise(rupees: number) { return Math.round(rupees * 100); }

const MERCHANTS = [
  'ShopEase India', 'QuickBuy Online', 'FreshMart Express', 'TechGadgets Hub',
  'FoodZone Delivery', 'StyleWear Fashion', 'BookWorm Store', 'HealthPlus Pharmacy',
  'AutoParts Direct', 'GreenGrocer Fresh', 'ElectroniX World', 'HomeDecor Pro'
];

const METHODS: Array<'upi' | 'card' | 'netbanking' | 'wallet'> = ['upi', 'card', 'netbanking', 'wallet'];

let simulatorInterval: ReturnType<typeof setInterval> | null = null;
let txnCounter = 0;

async function generateLiveTransaction() {
  const db = getDb();
  const amount = paise(100 + Math.floor(Math.random() * 15000));
  const fee = Math.round(amount * MDR_RATE);
  const tax = Math.round(fee * GST_ON_MDR);
  const net = amount - fee - tax;
  const payId = genId('pay');
  const orderId = genId('order');
  const method = METHODS[Math.floor(Math.random() * METHODS.length)];
  const merchant = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
  const now = new Date().toISOString();
  const txnId = genId('txn');

  // Randomly decide: normal payment (70%), refund (15%), settlement (15%)
  const roll = Math.random();
  let type = 'payment';
  let status = 'captured';

  if (roll > 0.85) {
    type = 'settlement';
    status = 'settled';
  } else if (roll > 0.70) {
    type = 'refund';
    status = 'refunded';
  }

  const setlId = type === 'settlement' ? genId('setl') : (Math.random() > 0.3 ? genId('setl') : null);
  const utr = type === 'settlement' ? `UTR${Date.now()}${txnCounter}` : null;

  try {
    await db.query(`INSERT INTO canonical_transactions
      (id, tenant_id, source, type, amount_minor, currency, fee_minor, tax_minor, net_minor,
       payment_id, order_id, refund_id, settlement_id, utr, method, status,
       event_time, settlement_time, counterparty, description, raw_payload_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [txnId, TENANT_ID, 'razorpay_live', type, amount, 'INR', fee, tax, net,
      payId, orderId, type === 'refund' ? genId('rfnd') : null, setlId, utr,
      method, status, now, type === 'settlement' ? now : null,
      merchant, `Live ${type}: ${merchant}`, uuidv4(), now]
    );

    txnCounter++;

    eventBus.emit('txn:ingested', {
      id: txnId, type, amount_minor: amount, method, merchant,
      status, timestamp: now, counter: txnCounter
    });

    // Every 5 transactions, auto-run reconciliation
    if (txnCounter % 5 === 0) {
      const result = await runReconciliation(TENANT_ID);
      eventBus.emit('recon:completed', {
        runId: result.runId, matchRate: result.matchRate,
        matched: result.matched, unmatched: result.unmatched,
        precision: result.precision, recall: result.recall,
        f1Score: result.f1Score, newExceptions: result.exceptions.length
      });
    }
  } catch (error) {
    // Reconciliation may fail if data is being written simultaneously or db fails
    console.error('Simulator error:', error);
  }
}

export function startSimulator(intervalMs: number = 3000): { stop: () => void } {
  if (simulatorInterval) return { stop: stopSimulator };
  txnCounter = 0;

  simulatorInterval = setInterval(() => {
    generateLiveTransaction().catch(console.error);
  }, intervalMs);

  eventBus.emit('system:heartbeat', {
    type: 'simulator_started',
    interval_ms: intervalMs,
    message: `Live transaction simulator started (every ${intervalMs / 1000}s)`
  });

  return { stop: stopSimulator };
}

export function stopSimulator(): void {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
    eventBus.emit('system:heartbeat', {
      type: 'simulator_stopped',
      total_generated: txnCounter,
      message: `Simulator stopped after generating ${txnCounter} transactions`
    });
  }
}

export function isSimulatorRunning(): boolean {
  return simulatorInterval !== null;
}

export function getSimulatorStats() {
  return {
    running: simulatorInterval !== null,
    totalGenerated: txnCounter,
  };
}
