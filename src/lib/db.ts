import { Pool } from 'pg';

const isSupabase = (process.env.DATABASE_URL || '').includes('supabase');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/razorrecon',
  ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {})
});

export function getDb() {
  return pool;
}

export async function initSchema() {
  await pool.query(`
    -- Tenants
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

    -- Raw Events (immutable)
    CREATE TABLE IF NOT EXISTS raw_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_version INTEGER DEFAULT 1,
      raw_payload TEXT NOT NULL,
      payload_hash TEXT,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, source, source_record_id, event_version)
    );

    -- Canonical Transactions
    CREATE TABLE IF NOT EXISTS canonical_transactions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT DEFAULT 'INR',
      fee_minor INTEGER DEFAULT 0,
      tax_minor INTEGER DEFAULT 0,
      net_minor INTEGER DEFAULT 0,
      payment_id TEXT,
      order_id TEXT,
      refund_id TEXT,
      settlement_id TEXT,
      utr TEXT,
      method TEXT,
      status TEXT NOT NULL,
      event_time TEXT NOT NULL,
      settlement_time TEXT,
      counterparty TEXT,
      description TEXT,
      raw_payload_hash TEXT,
      ground_truth_outcome TEXT,
      ground_truth_target_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Settlement Batches
    CREATE TABLE IF NOT EXISTS settlement_batches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      settlement_id TEXT NOT NULL,
      utr TEXT NOT NULL,
      total_amount_minor INTEGER NOT NULL,
      total_fee_minor INTEGER DEFAULT 0,
      total_tax_minor INTEGER DEFAULT 0,
      net_amount_minor INTEGER NOT NULL,
      payment_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'processed',
      settled_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bank Entries
    CREATE TABLE IF NOT EXISTS bank_entries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      reference TEXT,
      debit_minor INTEGER DEFAULT 0,
      credit_minor INTEGER DEFAULT 0,
      balance_minor INTEGER DEFAULT 0,
      utr_extracted TEXT,
      matched INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Recon Runs
    CREATE TABLE IF NOT EXISTS recon_runs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      total_records INTEGER DEFAULT 0,
      matched INTEGER DEFAULT 0,
      unmatched INTEGER DEFAULT 0,
      partial_matched INTEGER DEFAULT 0,
      duplicates INTEGER DEFAULT 0,
      match_rate REAL DEFAULT 0,
      precision_score REAL DEFAULT 0,
      recall_score REAL DEFAULT 0,
      f1_score REAL DEFAULT 0,
      avg_latency_ms REAL DEFAULT 0,
      p95_latency_ms REAL DEFAULT 0,
      status TEXT DEFAULT 'running'
    );

    -- Match Candidates
    CREATE TABLE IF NOT EXISTS match_candidates (
      id TEXT PRIMARY KEY,
      recon_run_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT,
      match_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence_json TEXT DEFAULT '[]',
      rule_version TEXT DEFAULT 'v1.0',
      reason_code TEXT NOT NULL,
      processing_time_ms REAL DEFAULT 0,
      decision TEXT DEFAULT 'pending',
      decided_at TIMESTAMP,
      reviewer TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Exceptions
    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      recon_run_id TEXT,
      transaction_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      assigned_to TEXT,
      sla_deadline TIMESTAMP,
      amount_minor INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      description TEXT,
      evidence_json TEXT DEFAULT '[]',
      resolution_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );

    -- Exception Comments
    CREATE TABLE IF NOT EXISTS exception_comments (
      id TEXT PRIMARY KEY,
      exception_id TEXT NOT NULL REFERENCES exceptions(id),
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Control Policies
    CREATE TABLE IF NOT EXISTS control_policies (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      rule_json TEXT DEFAULT '{}',
      nlp_source TEXT,
      enabled INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_by TEXT,
      effective_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Interactions
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      model TEXT DEFAULT 'mock',
      tokens_used INTEGER DEFAULT 0,
      confidence REAL DEFAULT 0,
      citations_json TEXT DEFAULT '[]',
      proof_of_logic TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Events
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Health Scores
    CREATE TABLE IF NOT EXISTS health_scores (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      score REAL NOT NULL,
      match_rate_component REAL DEFAULT 0,
      exception_aging_component REAL DEFAULT 0,
      sla_compliance_component REAL DEFAULT 0,
      data_freshness_component REAL DEFAULT 0,
      settlement_timing_component REAL DEFAULT 0,
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Anomaly Signals
    CREATE TABLE IF NOT EXISTS anomaly_signals (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      time_bucket TEXT NOT NULL,
      amount_range TEXT NOT NULL,
      method TEXT DEFAULT 'all',
      score REAL NOT NULL,
      transaction_count INTEGER DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Settlement Fingerprints
    CREATE TABLE IF NOT EXISTS settlement_fingerprints (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      merchant_name TEXT,
      fee_pattern TEXT,
      timing_pattern TEXT,
      volume_pattern TEXT,
      fingerprint_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Prediction Scores
    CREATE TABLE IF NOT EXISTS prediction_scores (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      risk_score REAL NOT NULL,
      risk_factors_json TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Forecast Runs
    CREATE TABLE IF NOT EXISTS forecast_runs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      base_amount_minor INTEGER DEFAULT 0,
      upside_amount_minor INTEGER DEFAULT 0,
      downside_amount_minor INTEGER DEFAULT 0,
      confidence_p25 REAL DEFAULT 0,
      confidence_p75 REAL DEFAULT 0,
      assumptions_json TEXT DEFAULT '[]',
      period_days INTEGER DEFAULT 30,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON canonical_transactions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_payment ON canonical_transactions(payment_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_settlement ON canonical_transactions(settlement_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_utr ON canonical_transactions(utr);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON canonical_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_exceptions_tenant ON exceptions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
    CREATE INDEX IF NOT EXISTS idx_match_candidates_run ON match_candidates(recon_run_id);
    CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_bank_utr ON bank_entries(utr_extracted);
  `);
}

export default getDb;
