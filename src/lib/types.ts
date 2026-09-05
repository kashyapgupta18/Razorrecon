
// --- Enums ---
export type TransactionType = 'payment' | 'refund' | 'settlement' | 'transfer' | 'adjustment' | 'dispute' | 'fee' | 'tax';
export type TransactionStatus = 'captured' | 'authorized' | 'failed' | 'refunded' | 'settled' | 'processing' | 'pending';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'bank_transfer' | 'neft' | 'rtgs' | 'imps';
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

export type MatchType = 'exact_id' | 'exact_amount' | 'net_amount' | 'composite_split' | 'fuzzy' | 'ai_ranked' | 'manual';
export type MatchDecision = 'auto_approved' | 'approved' | 'rejected' | 'pending' | 'escalated';
export type ReasonCode =
  | 'EXACT_UTR' | 'EXACT_PAYMENT_ID' | 'EXACT_ORDER_ID' | 'EXACT_SETTLEMENT_ID'
  | 'AMOUNT_CURRENCY_WINDOW' | 'NET_AMOUNT_TOLERANCE' | 'COMPOSITE_BATCH'
  | 'FUZZY_DATE_REF' | 'AI_RANKED_TOP' | 'MANUAL_MATCH'
  | 'DUPLICATE_DETECTED' | 'TIMING_GAP' | 'AMOUNT_MISMATCH' | 'FEE_MISMATCH'
  | 'TAX_MISMATCH' | 'MISSING_COUNTERPART' | 'AMBIGUOUS';

export type ExceptionType = 'unmatched' | 'partial_match' | 'duplicate' | 'timing_gap' | 'amount_mismatch' | 'fee_mismatch' | 'tax_mismatch' | 'suspicious';
export type ExceptionStatus = 'open' | 'investigating' | 'resolved' | 'approved' | 'rejected' | 'escalated';
export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ReconRunStatus = 'running' | 'completed' | 'failed';
export type UserRole = 'admin' | 'controller' | 'analyst' | 'treasury' | 'viewer';

export type GroundTruth = 'MATCH' | 'PARTIAL' | 'UNMATCHED' | 'DUPLICATE';

// --- Core Entities ---
export interface CanonicalTransaction {
  id: string;
  tenant_id: string;
  source: string;
  type: TransactionType;
  amount_minor: number;  // in paise
  currency: Currency;
  fee_minor: number;
  tax_minor: number;
  net_minor: number;
  payment_id: string | null;
  order_id: string | null;
  refund_id: string | null;
  settlement_id: string | null;
  utr: string | null;
  method: PaymentMethod | null;
  status: TransactionStatus;
  event_time: string;
  settlement_time: string | null;
  counterparty: string | null;
  description: string | null;
  raw_payload_hash: string | null;
  created_at: string;
  // Benchmark fields
  ground_truth_outcome?: GroundTruth;
  ground_truth_target_id?: string | null;
}

export interface SettlementBatch {
  id: string;
  tenant_id: string;
  settlement_id: string;
  utr: string;
  total_amount_minor: number;
  total_fee_minor: number;
  total_tax_minor: number;
  net_amount_minor: number;
  payment_count: number;
  status: string;
  settled_at: string;
  created_at: string;
}

export interface BankEntry {
  id: string;
  tenant_id: string;
  date: string;
  description: string;
  reference: string | null;
  debit_minor: number;
  credit_minor: number;
  balance_minor: number;
  utr_extracted: string | null;
  matched: boolean;
  created_at: string;
}

// --- Reconciliation ---
export interface ReconRun {
  id: string;
  tenant_id: string;
  started_at: string;
  completed_at: string | null;
  total_records: number;
  matched: number;
  unmatched: number;
  partial: number;
  duplicates: number;
  match_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  status: ReconRunStatus;
}

export interface MatchCandidate {
  id: string;
  recon_run_id: string;
  source_id: string;
  target_id: string | null;
  match_type: MatchType;
  confidence: number;
  evidence: Evidence[];
  rule_version: string;
  reason_code: ReasonCode;
  processing_time_ms: number;
  decision: MatchDecision;
  decided_at: string | null;
  reviewer: string | null;
}

export interface Evidence {
  field: string;
  source_value: string;
  target_value: string;
  match_strength: number;
  description: string;
}

// --- Exceptions ---
export interface Exception {
  id: string;
  tenant_id: string;
  recon_run_id: string;
  transaction_id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  assigned_to: string | null;
  sla_deadline: string | null;
  amount_minor: number;
  currency: Currency;
  description: string;
  evidence: Evidence[];
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  // Joined data
  transaction?: CanonicalTransaction;
  comments?: ExceptionComment[];
  payment_id?: string;
  method?: string;
  counterparty?: string;
}

export interface ExceptionComment {
  id: string;
  exception_id: string;
  user_id: string;
  user_name: string;
  comment: string;
  created_at: string;
}

// --- Control Policies ---
export interface ControlPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  rule_json: object;
  nlp_source: string | null;
  enabled: boolean;
  version: number;
  created_by: string;
  effective_date: string;
  created_at: string;
}

// --- AI ---
export interface AIInteraction {
  id: string;
  tenant_id: string;
  query: string;
  response: string;
  model: string;
  tokens_used: number;
  confidence: number;
  citations: AICitation[];
  proof_of_logic: string;
  created_at: string;
}

export interface AICitation {
  record_id: string;
  record_type: string;
  field: string;
  value: string;
  relevance: number;
}

// --- Forecasts ---
export interface ForecastRun {
  id: string;
  tenant_id: string;
  base_amount_minor: number;
  upside_amount_minor: number;
  downside_amount_minor: number;
  confidence_p25: number;
  confidence_p75: number;
  assumptions: string[];
  period_days: number;
  created_at: string;
}

// --- Health Score ---
export interface HealthScore {
  id: string;
  tenant_id: string;
  score: number;
  match_rate_component: number;
  exception_aging_component: number;
  sla_compliance_component: number;
  data_freshness_component: number;
  settlement_timing_component: number;
  calculated_at: string;
}

// --- Anomaly ---
export interface AnomalySignal {
  id: string;
  tenant_id: string;
  time_bucket: string;
  amount_range: string;
  method: PaymentMethod | 'all';
  score: number;
  transaction_count: number;
  description: string;
  created_at: string;
}

// --- Audit ---
export interface AuditEvent {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: object;
  created_at: string;
}

// --- Benchmark ---
export interface BenchmarkResult {
  record_id: string;
  expected_outcome: GroundTruth;
  actual_outcome: GroundTruth;
  confidence: number;
  evidence_summary: string;
  processing_time_ms: number;
  resolution_status: string;
  correct: boolean;
}

export interface BenchmarkReport {
  total_records: number;
  matched: number;
  unmatched: number;
  duplicates_detected: number;
  match_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positives: number;
  false_negatives: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  idempotency_passed: boolean;
  results: BenchmarkResult[];
  unresolved_exceptions: UnresolvedException[];
}

export interface UnresolvedException {
  record_id: string;
  type: ExceptionType;
  reason: string;
  evidence_missing: string;
  amount_minor: number;
  currency: Currency;
}

// --- Dashboard ---
export interface DashboardStats {
  total_transactions: number;
  total_matched: number;
  total_exceptions: number;
  match_rate: number;
  unresolved_exposure_minor: number;
  avg_settlement_delay_hours: number;
  health_score: HealthScore | null;
  recent_activity: ActivityItem[];
  exception_by_type: Record<ExceptionType, number>;
  anomaly_heatmap: AnomalySignal[];
  trend_data: TrendPoint[];
}

export interface ActivityItem {
  id: string;
  type: 'ingestion' | 'match' | 'exception' | 'resolution' | 'ai_query';
  description: string;
  timestamp: string;
  severity?: ExceptionSeverity;
}

export interface TrendPoint {
  date: string;
  match_rate: number;
  exceptions: number;
  volume: number;
}
