// ============================================================
// RazorRecon AI — Synthetic Data Generator (60+ records)
// Per PDF Section 9: Known ground truth for benchmark
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import type { CanonicalTransaction } from './types';
import { Pool } from 'pg';

const TENANT_ID = 'tenant_demo_001';
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

const ORDER_DESCRIPTIONS = [
  'Monthly SaaS subscription', 'E-commerce order fulfillment', 'Food delivery commission',
  'Premium membership renewal', 'Ad campaign payment', 'Insurance premium collection',
  'Travel booking confirmation', 'Event ticket purchase', 'Electronics purchase',
  'Grocery order settlement', 'Fashion marketplace sale', 'Cloud hosting charges',
  'Logistics & delivery fees', 'Digital marketing services', 'Software license renewal',
  'Consulting services payment', 'Raw material procurement', 'Office supplies purchase',
  'Employee reimbursement', 'Vendor invoice settlement', 'Franchise royalty payment',
  'Utility bill collection', 'Investment advisory fees', 'Annual maintenance contract',
  'Training program enrollment', 'Bulk merchandise order', 'Seasonal campaign payment',
  'Customer refund processing', 'Warranty claim settlement', 'Platform fee collection'
];

const BANK_NARRATIONS = [
  'NEFT/RAZORPAY/SETTLEMENT', 'RTGS/RAZORPAY/BATCH', 'IMPS/PGSETTLE/RAZORPAY',
  'NEFT/PAYIN/RAZORPAY', 'RTGS/MERCHANT/SETTLEMENT', 'IMPS/RECON/RZPSETL'
];

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function genId(prefix: string) { return `${prefix}_${uuidv4().slice(0, 12)}`; }
function paise(rupees: number) { return Math.round(rupees * 100); }
function randomDate(daysBack: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}
function settlementDate(eventTime: string, daysLater: number = 2) {
  const d = new Date(eventTime);
  d.setDate(d.getDate() + daysLater);
  return d.toISOString();
}

interface SeedRecord {
  payment: CanonicalTransaction;
  settlement: CanonicalTransaction | null;
  bankEntry?: { utr: string; credit_minor: number; date: string; description: string };
}

const MDR_RATE = 0.02;       // 2% MDR
const GST_ON_MDR = 0.18;     // 18% GST on MDR

export function generateSyntheticData() {
  const records: SeedRecord[] = [];

  // ============================================================
  // Category 1: 25 Exact payment→settlement matches
  // ============================================================
  for (let i = 0; i < 25; i++) {
    const amount = paise(500 + Math.floor(Math.random() * 9500)); // ₹500-₹10,000
    const fee = Math.round(amount * MDR_RATE);
    const tax = Math.round(fee * GST_ON_MDR);
    const net = amount - fee - tax;
    const payId = genId('pay');
    const orderId = genId('order');
    const setlId = genId('setl');
    const utr = `UTR${Date.now()}${i}${Math.floor(Math.random()*1000)}`;
    const eventTime = randomDate(30);
    const methods: Array<'upi' | 'card' | 'netbanking' | 'wallet'> = ['upi', 'card', 'netbanking', 'wallet'];
    const method = methods[i % 4];

    records.push({
      payment: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'payment', amount_minor: amount, currency: 'INR',
        fee_minor: fee, tax_minor: tax, net_minor: net,
        payment_id: payId, order_id: orderId, refund_id: null,
        settlement_id: setlId, utr, method, status: 'captured',
        event_time: eventTime, settlement_time: settlementDate(eventTime),
        counterparty: MERCHANTS[i % MERCHANTS.length], description: `${pickRandom(ORDER_DESCRIPTIONS)} — ${MERCHANTS[i % MERCHANTS.length]}`,
        raw_payload_hash: uuidv4(), created_at: eventTime,
        ground_truth_outcome: 'MATCH', ground_truth_target_id: setlId
      },
      settlement: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'settlement', amount_minor: net, currency: 'INR',
        fee_minor: 0, tax_minor: 0, net_minor: net,
        payment_id: payId, order_id: null, refund_id: null,
        settlement_id: setlId, utr, method: 'neft', status: 'settled',
        event_time: settlementDate(eventTime), settlement_time: settlementDate(eventTime),
        counterparty: MERCHANTS[i % MERCHANTS.length], description: `Settlement payout — ${MERCHANTS[i % MERCHANTS.length]}`,
        raw_payload_hash: uuidv4(), created_at: settlementDate(eventTime),
        ground_truth_outcome: 'MATCH', ground_truth_target_id: payId
      },
      bankEntry: { utr, credit_minor: net, date: settlementDate(eventTime).slice(0,10), description: `${pickRandom(BANK_NARRATIONS)}/${utr}/${MERCHANTS[i % MERCHANTS.length].toUpperCase().slice(0,15)}` }
    });
  }

  // ============================================================
  // Category 2: 10 Partial/batched settlement cases
  // ============================================================
  for (let b = 0; b < 5; b++) { // 5 batches, 2 payments each = 10
    const setlId = genId('setl');
    const utr = `UTRBATCH${Date.now()}${b}`;
    const eventTime = randomDate(20);
    let batchTotal = 0;

    for (let p = 0; p < 2; p++) {
      const amount = paise(1000 + Math.floor(Math.random() * 5000));
      const fee = Math.round(amount * MDR_RATE);
      const tax = Math.round(fee * GST_ON_MDR);
      const net = amount - fee - tax;
      batchTotal += net;
      const payId = genId('pay');

      records.push({
        payment: {
          id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
          type: 'payment', amount_minor: amount, currency: 'INR',
          fee_minor: fee, tax_minor: tax, net_minor: net,
          payment_id: payId, order_id: genId('order'), refund_id: null,
          settlement_id: setlId, utr: null, method: 'card', status: 'captured',
          event_time: eventTime, settlement_time: settlementDate(eventTime),
          counterparty: MERCHANTS[(b * 2 + p + 25) % MERCHANTS.length], description: `Batched payment — ${pickRandom(ORDER_DESCRIPTIONS)}`,
          raw_payload_hash: uuidv4(), created_at: eventTime,
          ground_truth_outcome: 'PARTIAL', ground_truth_target_id: setlId
        },
        settlement: null
      });
    }
    // One settlement for the batch
    records.push({
      payment: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'settlement', amount_minor: batchTotal, currency: 'INR',
        fee_minor: 0, tax_minor: 0, net_minor: batchTotal,
        payment_id: null, order_id: null, refund_id: null,
        settlement_id: setlId, utr, method: 'neft', status: 'settled',
        event_time: settlementDate(eventTime), settlement_time: settlementDate(eventTime),
        counterparty: MERCHANTS[(b * 2 + 25) % MERCHANTS.length], description: `Batch settlement payout — ${MERCHANTS[(b * 2 + 25) % MERCHANTS.length]}`,
        raw_payload_hash: uuidv4(), created_at: settlementDate(eventTime),
        ground_truth_outcome: 'PARTIAL', ground_truth_target_id: null
      },
      settlement: null,
      bankEntry: { utr, credit_minor: batchTotal, date: settlementDate(eventTime).slice(0,10), description: `${pickRandom(BANK_NARRATIONS)}/${utr}/BATCH-SETTLE` }
    });
  }

  // ============================================================
  // Category 3: 6 Refunds and reversals
  // ============================================================
  for (let r = 0; r < 6; r++) {
    const amount = paise(500 + Math.floor(Math.random() * 3000));
    const refundAmount = r < 3 ? amount : Math.round(amount * 0.5); // 3 full, 3 partial
    const payId = genId('pay');
    const refundId = genId('rfnd');
    const eventTime = randomDate(15);

    records.push({
      payment: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'refund', amount_minor: refundAmount, currency: 'INR',
        fee_minor: 0, tax_minor: 0, net_minor: -refundAmount,
        payment_id: payId, order_id: genId('order'), refund_id: refundId,
        settlement_id: null, utr: null, method: r < 3 ? 'upi' : 'card',
        status: 'refunded',
        event_time: eventTime, settlement_time: null,
        counterparty: MERCHANTS[(r + 35) % MERCHANTS.length],
        description: r < 3 ? `Full refund — ${pickRandom(ORDER_DESCRIPTIONS)}` : `Partial refund (50%) — ${pickRandom(ORDER_DESCRIPTIONS)}`,
        raw_payload_hash: uuidv4(), created_at: eventTime,
        ground_truth_outcome: 'MATCH', ground_truth_target_id: payId
      },
      settlement: null
    });
  }

  // ============================================================
  // Category 4: 5 Fee/tax variances
  // ============================================================
  for (let f = 0; f < 5; f++) {
    const amount = paise(2000 + Math.floor(Math.random() * 5000));
    const correctFee = Math.round(amount * MDR_RATE);
    const correctTax = Math.round(correctFee * GST_ON_MDR);
    // Introduce variance: wrong fee, wrong tax, or zero-MDR UPI
    let fee = correctFee, tax = correctTax;
    let desc = '';
    if (f < 2) { fee = correctFee + paise(5); desc = 'MDR overcharge by ₹5'; }
    else if (f < 4) { tax = correctTax - paise(2); desc = 'GST undercharged by ₹2'; }
    else { fee = 0; tax = 0; desc = 'Zero-MDR UPI but fee expected'; }

    records.push({
      payment: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'payment', amount_minor: amount, currency: 'INR',
        fee_minor: fee, tax_minor: tax, net_minor: amount - fee - tax,
        payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
        settlement_id: genId('setl'), utr: `UTRFEE${Date.now()}${f}`, method: f === 4 ? 'upi' : 'card',
        status: 'captured',
        event_time: randomDate(10), settlement_time: null,
        counterparty: MERCHANTS[(f + 30) % MERCHANTS.length], description: `${desc} — ${MERCHANTS[(f + 30) % MERCHANTS.length]}`,
        raw_payload_hash: uuidv4(), created_at: randomDate(10),
        ground_truth_outcome: 'MATCH', ground_truth_target_id: null
      },
      settlement: null
    });
  }

  // ============================================================
  // Category 5: 4 Duplicates
  // ============================================================
  for (let d = 0; d < 4; d++) {
    const amount = paise(1000 + Math.floor(Math.random() * 4000));
    const fee = Math.round(amount * MDR_RATE);
    const tax = Math.round(fee * GST_ON_MDR);
    const payId = genId('pay');
    const eventTime = randomDate(12);

    const base: CanonicalTransaction = {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: amount, currency: 'INR',
      fee_minor: fee, tax_minor: tax, net_minor: amount - fee - tax,
      payment_id: payId, order_id: genId('order'), refund_id: null,
      settlement_id: genId('setl'), utr: null, method: 'upi', status: 'captured',
      event_time: eventTime, settlement_time: null,
      counterparty: MERCHANTS[(d + 20) % MERCHANTS.length], description: `Duplicate webhook — ${pickRandom(ORDER_DESCRIPTIONS)}`,
      raw_payload_hash: uuidv4(), created_at: eventTime,
      ground_truth_outcome: 'DUPLICATE', ground_truth_target_id: null
    };

    // Insert original
    records.push({ payment: { ...base }, settlement: null });
    // Insert duplicate (same payment_id, slightly later received_at)
    records.push({
      payment: {
        ...base, id: genId('txn'), // different txn id but same payment_id
        description: `DUPLICATE of ${payId} — ${MERCHANTS[(d + 20) % MERCHANTS.length]}`,
        created_at: new Date(new Date(eventTime).getTime() + 5000).toISOString()
      },
      settlement: null
    });
  }

  // ============================================================
  // Category 6: 4 Delayed/missing records
  // ============================================================
  // 2 settlements without matching payment
  for (let m = 0; m < 2; m++) {
    records.push({
      payment: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'settlement', amount_minor: paise(3000 + Math.random() * 2000),
        currency: 'INR', fee_minor: 0, tax_minor: 0,
        net_minor: paise(3000 + Math.random() * 2000),
        payment_id: genId('pay_missing'), order_id: null, refund_id: null,
        settlement_id: genId('setl'), utr: `UTRMISSING${m}${Date.now()}`,
        method: 'neft', status: 'settled',
        event_time: randomDate(5), settlement_time: randomDate(5),
        counterparty: MERCHANTS[(m + 15) % MERCHANTS.length], description: `Settlement with no matching payment — ${MERCHANTS[(m + 15) % MERCHANTS.length]}`,
        raw_payload_hash: uuidv4(), created_at: randomDate(5),
        ground_truth_outcome: 'UNMATCHED', ground_truth_target_id: null
      },
      settlement: null
    });
  }
  // 2 payments without matching settlement
  for (let m = 0; m < 2; m++) {
    records.push({
      payment: {
        id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
        type: 'payment', amount_minor: paise(2000 + Math.random() * 3000),
        currency: 'INR', fee_minor: paise(50), tax_minor: paise(9),
        net_minor: paise(1941), payment_id: genId('pay'), order_id: genId('order'),
        refund_id: null, settlement_id: null, utr: null, method: 'card',
        status: 'captured',
        event_time: randomDate(3), settlement_time: null,
        counterparty: MERCHANTS[(m + 10) % MERCHANTS.length], description: `Payment awaiting settlement — ${pickRandom(ORDER_DESCRIPTIONS)}`,
        raw_payload_hash: uuidv4(), created_at: randomDate(3),
        ground_truth_outcome: 'UNMATCHED', ground_truth_target_id: null
      },
      settlement: null
    });
  }

  // ============================================================
  // Category 7: 3 Currency/rounding edge cases
  // ============================================================
  // Paise rounding
  records.push({
    payment: {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: 99999, currency: 'INR', // ₹999.99
      fee_minor: 2000, tax_minor: 360, net_minor: 97639,
      payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
      settlement_id: genId('setl'), utr: `UTRROUND1${Date.now()}`, method: 'card',
      status: 'captured', event_time: randomDate(7), settlement_time: null,
      counterparty: 'Titan Company Ltd', description: 'Paise rounding edge case (₹999.99) — Titan Company Ltd',
      raw_payload_hash: uuidv4(), created_at: randomDate(7),
      ground_truth_outcome: 'MATCH', ground_truth_target_id: null
    }, settlement: null
  });
  // ₹0.01 variance
  records.push({
    payment: {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: 500001, currency: 'INR', // ₹5000.01
      fee_minor: 10000, tax_minor: 1800, net_minor: 488201,
      payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
      settlement_id: genId('setl'), utr: `UTRROUND2${Date.now()}`, method: 'netbanking',
      status: 'captured', event_time: randomDate(7), settlement_time: null,
      counterparty: 'Asian Paints Ltd', description: '₹0.01 variance edge case — Asian Paints Ltd',
      raw_payload_hash: uuidv4(), created_at: randomDate(7),
      ground_truth_outcome: 'MATCH', ground_truth_target_id: null
    }, settlement: null
  });
  // International card INR conversion
  records.push({
    payment: {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: 750000, currency: 'INR', // ₹7500 (converted from $90)
      fee_minor: 22500, tax_minor: 4050, net_minor: 723450,
      payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
      settlement_id: genId('setl'), utr: `UTRINTL${Date.now()}`, method: 'card',
      status: 'captured', event_time: randomDate(7), settlement_time: null,
      counterparty: 'Amazon Seller Services', description: 'International card converted to INR — Amazon Seller Services',
      raw_payload_hash: uuidv4(), created_at: randomDate(7),
      ground_truth_outcome: 'MATCH', ground_truth_target_id: null
    }, settlement: null
  });

  // ============================================================
  // Category 8: 3 Deliberately ambiguous cases
  // ============================================================
  const ambigTime = randomDate(5);
  const ambigAmount = paise(5000);
  // Same amount, same day, different merchants
  records.push({
    payment: {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: ambigAmount, currency: 'INR',
      fee_minor: Math.round(ambigAmount * MDR_RATE), tax_minor: Math.round(ambigAmount * MDR_RATE * GST_ON_MDR),
      net_minor: ambigAmount - Math.round(ambigAmount * MDR_RATE) - Math.round(ambigAmount * MDR_RATE * GST_ON_MDR),
      payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
      settlement_id: null, utr: null, method: 'upi', status: 'captured',
      event_time: ambigTime, settlement_time: null,
      counterparty: 'Zomato Food Delivery', description: 'Ambiguous: same amount, same day as Swiggy',
      raw_payload_hash: uuidv4(), created_at: ambigTime,
      ground_truth_outcome: 'UNMATCHED', ground_truth_target_id: null
    }, settlement: null
  });
  records.push({
    payment: {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: ambigAmount, currency: 'INR',
      fee_minor: Math.round(ambigAmount * MDR_RATE), tax_minor: Math.round(ambigAmount * MDR_RATE * GST_ON_MDR),
      net_minor: ambigAmount - Math.round(ambigAmount * MDR_RATE) - Math.round(ambigAmount * MDR_RATE * GST_ON_MDR),
      payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
      settlement_id: null, utr: null, method: 'upi', status: 'captured',
      event_time: ambigTime, settlement_time: null,
      counterparty: 'Swiggy Bundl Technologies', description: 'Ambiguous: same amount, same day as Zomato',
      raw_payload_hash: uuidv4(), created_at: ambigTime,
      ground_truth_outcome: 'UNMATCHED', ground_truth_target_id: null
    }, settlement: null
  });
  // Partial amount overlap
  records.push({
    payment: {
      id: genId('txn'), tenant_id: TENANT_ID, source: 'razorpay',
      type: 'payment', amount_minor: paise(5001), currency: 'INR', // ₹50.01 off from ambig
      fee_minor: paise(100), tax_minor: paise(18), net_minor: paise(4883),
      payment_id: genId('pay'), order_id: genId('order'), refund_id: null,
      settlement_id: null, utr: null, method: 'card', status: 'captured',
      event_time: ambigTime, settlement_time: null,
      counterparty: 'Dunzo Digital Pvt Ltd', description: 'Ambiguous: amount overlaps with Zomato/Swiggy records',
      raw_payload_hash: uuidv4(), created_at: ambigTime,
      ground_truth_outcome: 'UNMATCHED', ground_truth_target_id: null
    }, settlement: null
  });

  return { records, tenantId: TENANT_ID };
}

export async function seedDatabase(db: Pool) {
  const { records, tenantId } = generateSyntheticData();

  // Check if already seeded (50+ means full synthetic data is loaded; a few simulator records shouldn't block)
  const existingRes = await db.query('SELECT COUNT(*) as count FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
  const count_val = parseInt(existingRes.rows[0].count, 10) || 0;
  if (count_val >= 50) return { count: count_val, alreadySeeded: true };

  // Clear any partial data (e.g., from simulator) before full seed
  if (count_val > 0) {
    await db.query('DELETE FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM match_candidates WHERE recon_run_id IN (SELECT id FROM recon_runs WHERE tenant_id = $1)', [tenantId]);
    await db.query('DELETE FROM exceptions WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM recon_runs WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM audit_events WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM health_scores WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM anomaly_signals WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM bank_entries WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM settlement_batches WHERE tenant_id = $1', [tenantId]);
  }

  // Insert tenant
  await db.query('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tenantId, 'RazorRecon Finance Pvt Ltd']);

  // Insert demo user
  await db.query('INSERT INTO users (id, tenant_id, email, name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [
    'user_demo_001', tenantId, 'controller@razorrecon.ai', 'Finance Controller', 'controller'
  ]);
  await db.query('INSERT INTO users (id, tenant_id, email, name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [
    'user_demo_002', tenantId, 'analyst@razorrecon.ai', 'Finance Analyst', 'analyst'
  ]);

  // Insert default control policies
  const policies = [
    { name: 'Settlement Variance Tolerance', desc: 'Allow ±₹5 variance in settlement matching', rule: { type: 'tolerance', field: 'amount', tolerance_minor: 500, currency: 'INR' } },
    { name: 'MDR Cap Alert', desc: 'Flag if MDR exceeds 2.5% of gross', rule: { type: 'threshold', field: 'mdr_rate', max: 0.025 } },
    { name: 'Duplicate Detection Window', desc: 'Detect duplicates within 60-second window', rule: { type: 'window', field: 'duplicate', window_seconds: 60 } },
    { name: 'Auto-approve threshold', desc: 'Auto-approve matches with confidence > 95%', rule: { type: 'auto_approve', min_confidence: 95, max_amount_minor: 10000000 } },
  ];
  for (const p of policies) {
    await db.query(`INSERT INTO control_policies (id, tenant_id, name, description, rule_json, enabled, created_by, effective_date) VALUES ($1, $2, $3, $4, $5, 1, $6, NOW())`, [
      genId('pol'), tenantId, p.name, p.desc, JSON.stringify(p.rule), 'system'
    ]);
  }

  let count = 0;
  let balance = paise(100000); // Starting bank balance ₹1,00,000

  // TRANSACTION
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    for (const rec of records) {
      const p = rec.payment;
      await client.query(`INSERT INTO canonical_transactions 
        (id, tenant_id, source, type, amount_minor, currency, fee_minor, tax_minor, net_minor,
         payment_id, order_id, refund_id, settlement_id, utr, method, status,
         event_time, settlement_time, counterparty, description, raw_payload_hash,
         ground_truth_outcome, ground_truth_target_id, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
        [p.id, p.tenant_id, p.source, p.type, p.amount_minor, p.currency,
        p.fee_minor, p.tax_minor, p.net_minor, p.payment_id, p.order_id, p.refund_id,
        p.settlement_id, p.utr, p.method, p.status, p.event_time, p.settlement_time,
        p.counterparty, p.description, p.raw_payload_hash, p.ground_truth_outcome,
        p.ground_truth_target_id, p.created_at]);
      count++;

      if (rec.settlement) {
        const s = rec.settlement;
        await client.query(`INSERT INTO canonical_transactions 
          (id, tenant_id, source, type, amount_minor, currency, fee_minor, tax_minor, net_minor,
           payment_id, order_id, refund_id, settlement_id, utr, method, status,
           event_time, settlement_time, counterparty, description, raw_payload_hash,
           ground_truth_outcome, ground_truth_target_id, created_at) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
          [s.id, s.tenant_id, s.source, s.type, s.amount_minor, s.currency,
          s.fee_minor, s.tax_minor, s.net_minor, s.payment_id, s.order_id, s.refund_id,
          s.settlement_id, s.utr, s.method, s.status, s.event_time, s.settlement_time,
          s.counterparty, s.description, s.raw_payload_hash, s.ground_truth_outcome,
          s.ground_truth_target_id, s.created_at]);
        count++;
      }

      if (rec.bankEntry) {
        balance += rec.bankEntry.credit_minor;
        await client.query(`INSERT INTO bank_entries 
          (id, tenant_id, date, description, reference, debit_minor, credit_minor, balance_minor, utr_extracted) 
          VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)`,
          [genId('bank'), TENANT_ID, rec.bankEntry.date, rec.bankEntry.description,
          rec.bankEntry.utr, rec.bankEntry.credit_minor, balance, rec.bankEntry.utr]);
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Generate anomaly heatmap data
  const timeBuckets = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];
  const amountRanges = ['0-1000', '1000-5000', '5000-10000', '10000+'];
  const methods = ['upi', 'card', 'netbanking', 'wallet'];
  for (const tb of timeBuckets) {
    for (const ar of amountRanges) {
      const score = Math.random() * 100;
      const txnCount = Math.floor(Math.random() * 20) + 1;
      await db.query(`INSERT INTO anomaly_signals (id, tenant_id, time_bucket, amount_range, method, score, transaction_count, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        genId('anom'), tenantId, tb, ar, methods[Math.floor(Math.random() * 4)],
        score, txnCount, score > 70 ? 'High anomaly cluster detected' : 'Normal activity'
      ]);
    }
  }

  // Generate initial health score
  await db.query(`INSERT INTO health_scores (id, tenant_id, score, match_rate_component, exception_aging_component, sla_compliance_component, data_freshness_component, settlement_timing_component) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
    genId('hs'), tenantId, 72, 85, 60, 78, 90, 65
  ]);

  return { count, alreadySeeded: false };
}
