// ============================================================
// RazorRecon AI — Live Transaction Simulator
// Generates realistic transactions in real-time to simulate
// production webhook ingestion from Razorpay
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { eventBus } from './event-bus';
import { runReconciliation } from './reconciliation-engine';

// Remove global TENANT_ID
const MDR_RATE = 0.02;
const GST_ON_MDR = 0.18;

function genId(prefix: string) { return `${prefix}_${uuidv4().slice(0, 12)}`; }
function paise(rupees: number) { return Math.round(rupees * 100); }

const MERCHANTS = [
  'Reliance Retail Ltd', 'Tata Consultancy Services', 'Flipkart Internet Pvt Ltd',
  'Infosys Technologies', 'Wipro Consumer Care', 'Zomato Food Delivery',
  'Swiggy Bundl Technologies', 'BigBasket (Innovative Retail)',
  'PhonePe Pvt Ltd', 'Paytm E-Commerce', 'Myntra Designs Pvt Ltd',
  'Nykaa E-Retail', 'Urban Company', 'Ola Electric Mobility',
  'MakeMyTrip India', 'BookMyShow', 'Croma (Infiniti Retail)',
  'Amazon Seller Services', 'Zerodha Broking Ltd', 'Razorpay Software Pvt Ltd',
  'PolicyBazaar Insurance', 'Lenskart Solutions', 'Sugar Cosmetics Pvt Ltd',
  'Mamaearth (Honasa Consumer)', 'boAt Lifestyle', 'Dunzo Digital Pvt Ltd',
  'JioMart Digital', 'CRED', 'Groww Fintech Pvt Ltd', 'Meesho Inc',
  'FirstCry (BrainBees Solutions)', 'Haldiram Snacks Pvt Ltd',
  'Titan Company Ltd', 'Asian Paints Ltd', 'Jubilant FoodWorks (Dominos)',
  'Burger King India', 'PVR INOX Ltd', 'Decathlon Sports India',
  'IKEA India Pvt Ltd', 'Pepperfry Home Furnishing'
];

const ORDER_TYPES = [
  'E-commerce order', 'Food delivery', 'Subscription renewal', 'Travel booking',
  'Insurance premium', 'Grocery purchase', 'Electronics order', 'Fashion purchase',
  'Utility payment', 'SaaS invoice', 'Movie ticket', 'Cab fare settlement'
];

const METHODS: Array<'upi' | 'card' | 'netbanking' | 'wallet'> = ['upi', 'card', 'netbanking', 'wallet'];

const simulatorIntervals = new Map<string, ReturnType<typeof setInterval>>();
const txnCounters = new Map<string, number>();

async function generateLiveTransaction(tenantId: string) {
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

  let txnCounter = txnCounters.get(tenantId) || 0;
  const setlId = type === 'settlement' ? genId('setl') : (Math.random() > 0.3 ? genId('setl') : null);
  const utr = type === 'settlement' ? `UTR${Date.now()}${txnCounter}` : null;

  try {
    await db.query(`INSERT INTO canonical_transactions
      (id, tenant_id, source, type, amount_minor, currency, fee_minor, tax_minor, net_minor,
       payment_id, order_id, refund_id, settlement_id, utr, method, status,
       event_time, settlement_time, counterparty, description, raw_payload_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [txnId, tenantId, 'razorpay_live', type, amount, 'INR', fee, tax, net,
      payId, orderId, type === 'refund' ? genId('rfnd') : null, setlId, utr,
      method, status, now, type === 'settlement' ? now : null,
      merchant, `Live ${type}: ${ORDER_TYPES[Math.floor(Math.random() * ORDER_TYPES.length)]} — ${merchant}`, uuidv4(), now]
    );

    txnCounter++;
    txnCounters.set(tenantId, txnCounter);

    eventBus.emit('txn:ingested', {
      id: txnId, tenant_id: tenantId, type, amount_minor: amount, method, merchant,
      status, timestamp: now, counter: txnCounter
    });

    // Every 5 transactions, auto-run reconciliation
    if (txnCounter % 5 === 0) {
      const result = await runReconciliation(tenantId);
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

export function startSimulator(tenantId: string, intervalMs: number = 3000): { stop: () => void } {
  if (simulatorIntervals.has(tenantId)) return { stop: () => stopSimulator(tenantId) };
  txnCounters.set(tenantId, 0);

  // Fire the first transaction immediately so the user sees instant feedback
  generateLiveTransaction(tenantId).catch(console.error);

  const interval = setInterval(() => {
    generateLiveTransaction(tenantId).catch(console.error);
  }, intervalMs);
  
  simulatorIntervals.set(tenantId, interval);

  eventBus.emit('system:heartbeat', {
    tenant_id: tenantId,
    type: 'simulator_started',
    interval_ms: intervalMs,
    message: `Live transaction simulator started (every ${intervalMs / 1000}s)`
  });

  return { stop: () => stopSimulator(tenantId) };
}

export function stopSimulator(tenantId: string): void {
  const interval = simulatorIntervals.get(tenantId);
  if (interval) {
    clearInterval(interval);
    simulatorIntervals.delete(tenantId);
    
    const count = txnCounters.get(tenantId) || 0;
    eventBus.emit('system:heartbeat', {
      tenant_id: tenantId,
      type: 'simulator_stopped',
      total_generated: count,
      message: `Simulator stopped after generating ${count} transactions`
    });
  }
}

export function isSimulatorRunning(tenantId: string): boolean {
  return simulatorIntervals.has(tenantId);
}

export function getSimulatorStats(tenantId: string) {
  return {
    running: simulatorIntervals.has(tenantId),
    totalGenerated: txnCounters.get(tenantId) || 0,
  };
}
