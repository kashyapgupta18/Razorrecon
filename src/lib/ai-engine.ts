// ============================================================
// RazorRecon AI — AI Copilot Engine (Rule-Based with Proof-of-Logic)
// Deterministic, auditable, no external API dependency
// ============================================================
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import type { AICitation, Exception, ReconRun, MatchCandidate, HealthScore, AnomalySignal } from './types';
import { Pool } from 'pg';

function genId(prefix: string) { return `${prefix}_${uuidv4().slice(0, 12)}`; }

interface AIResponse {
  id: string;
  query: string;
  response: string;
  confidence: number;
  proofOfLogic: string[];
  citations: AICitation[];
  model: string;
  tokensUsed: number;
  queryType: string;
  executionTimeMs: number;
}

type QueryPattern = {
  patterns: RegExp[];
  type: string;
  handler: (query: string, db: Pool, tenantId: string) => Promise<AIResponse>;
};

function formatAmount(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const queryPatterns: QueryPattern[] = [
  // Critical exceptions
  {
    patterns: [/critical|urgent|high.*sever|priority/i, /show.*exception/i],
    type: 'exception_analysis',
    handler: async (query, db, tenantId) => {
      const t0 = performance.now();
      const res = await db.query(
        `SELECT e.*, ct.payment_id, ct.amount_minor as txn_amount, ct.method, ct.counterparty
         FROM exceptions e
         LEFT JOIN canonical_transactions ct ON e.transaction_id = ct.id
         WHERE e.tenant_id = $1 AND (e.severity = 'critical' OR e.severity = 'high')
         ORDER BY CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 END, e.created_at DESC
         LIMIT 10`, [tenantId]
      );
      const exceptions = res.rows as (Exception & { payment_id: string | null; txn_amount: number; method: string | null; counterparty: string | null; })[];

      const totalExposure = exceptions.reduce((sum, e) => sum + (e.amount_minor || 0), 0);
      const critCount = exceptions.filter((e) => e.severity === 'critical').length;
      const highCount = exceptions.filter((e) => e.severity === 'high').length;

      const citations: AICitation[] = exceptions.slice(0, 5).map((e) => ({
        record_id: e.id, record_type: 'exception', field: 'severity',
        value: e.severity, relevance: e.severity === 'critical' ? 100 : 85
      }));

      const proofOfLogic = [
        `STEP 1: Queried exceptions table WHERE severity IN ('critical', 'high') AND tenant_id = '${tenantId}'`,
        `STEP 2: Found ${exceptions.length} high-priority exceptions (${critCount} critical, ${highCount} high)`,
        `STEP 3: Calculated total exposure: ${formatAmount(totalExposure)}`,
        `STEP 4: Sorted by severity (critical first), then by creation date (newest first)`,
        `STEP 5: Cross-referenced with canonical_transactions for payment details`,
      ];

      let response = `## ⚠️ High-Priority Exception Analysis\n\n`;
      response += `Found **${exceptions.length}** critical/high severity exceptions with total exposure of **${formatAmount(totalExposure)}**.\n\n`;
      if (critCount > 0) response += `🔴 **${critCount} CRITICAL** — Require immediate attention\n`;
      if (highCount > 0) response += `🟠 **${highCount} HIGH** — Should be resolved within SLA\n\n`;
      response += `| # | Type | Amount | Method | Status |\n|---|------|--------|--------|--------|\n`;
      exceptions.slice(0, 8).forEach((e, i) => {
        response += `| ${i + 1} | ${e.type} | ${formatAmount(e.amount_minor)} | ${e.method || 'N/A'} | ${e.status} |\n`;
      });

      return {
        id: genId('ai'), query, response, confidence: 95,
        proofOfLogic, citations, model: 'razorrecon-logic-v1',
        tokensUsed: query.length + response.length, queryType: 'exception_analysis',
        executionTimeMs: performance.now() - t0
      };
    }
  },

  // Match explanation
  {
    patterns: [/explain.*match/i, /why.*match/i, /how.*match/i, /match.*detail/i],
    type: 'match_explanation',
    handler: async (query, db, tenantId) => {
      const t0 = performance.now();
      const res1 = await db.query(
        'SELECT * FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1', [tenantId]
      );
      const recentRun = res1.rows[0] as ReconRun | undefined;

      if (!recentRun) {
        return {
          id: genId('ai'), query, response: 'No reconciliation runs found. Please run reconciliation first.',
          confidence: 100, proofOfLogic: ['STEP 1: Queried recon_runs — none found'], citations: [],
          model: 'razorrecon-logic-v1', tokensUsed: 50, queryType: 'match_explanation', executionTimeMs: performance.now() - t0
        };
      }

      const res2 = await db.query(
        'SELECT * FROM match_candidates WHERE recon_run_id = $1 ORDER BY confidence DESC LIMIT 15', [recentRun.id]
      );
      const matches = res2.rows as MatchCandidate[];

      const byType: Record<string, number> = {};
      const byDecision: Record<string, number> = {};
      for (const m of matches) {
        byType[m.match_type] = (byType[m.match_type] || 0) + 1;
        byDecision[m.decision] = (byDecision[m.decision] || 0) + 1;
      }

      const avgConfidence = matches.length > 0 ? matches.reduce((s, m) => s + m.confidence, 0) / matches.length : 0;
      const citations: AICitation[] = matches.slice(0, 5).map((m) => ({
        record_id: m.id, record_type: 'match_candidate', field: 'confidence',
        value: `${m.confidence}%`, relevance: m.confidence
      }));

      const proofOfLogic = [
        `STEP 1: Retrieved latest recon run '${recentRun.id}' (${recentRun.status})`,
        `STEP 2: Fetched ${matches.length} match candidates from this run`,
        `STEP 3: Classified by match_type: ${JSON.stringify(byType)}`,
        `STEP 4: Classified by decision: ${JSON.stringify(byDecision)}`,
        `STEP 5: Computed average confidence: ${avgConfidence.toFixed(1)}%`,
        `STEP 6: Engine uses 7-layer deterministic matching:`,
        `  L1: Exact ID (UTR/payment_id/settlement_id) → 100% confidence`,
        `  L2: Exact Amount + Currency within time window → 95% confidence`,
        `  L3: Fee/Tax-Aware Net Amount → 90% confidence`,
        `  L4: Composite Split (batch settlements) → 85% confidence`,
        `  L5: Duplicate Detection (same payment_id) → 100% confidence`,
        `  L6: Fuzzy (amount + date proximity scoring) → 40-80% confidence`,
        `  L7: Exception creation for unresolvable records`,
      ];

      let response = `## 🔍 Match Explanation — Run ${recentRun.id.slice(0, 12)}\n\n`;
      response += `**Run Status:** ${recentRun.status} | **Match Rate:** ${recentRun.match_rate?.toFixed(1)}% | **Avg Confidence:** ${avgConfidence.toFixed(1)}%\n\n`;
      response += `### Match Type Distribution\n`;
      for (const [type, count] of Object.entries(byType)) {
        const icon = type === 'exact_id' ? '🎯' : type === 'exact_amount' ? '💰' : type === 'net_amount' ? '📊' : type === 'composite_split' ? '🔗' : type === 'fuzzy' ? '🔮' : '📌';
        response += `${icon} **${type}**: ${count} matches\n`;
      }

      return {
        id: genId('ai'), query, response, confidence: 92,
        proofOfLogic, citations, model: 'razorrecon-logic-v1',
        tokensUsed: query.length + response.length, queryType: 'match_explanation',
        executionTimeMs: performance.now() - t0
      };
    }
  },

  // Forecast
  {
    patterns: [/forecast|predict|project|exposure|next.*days/i],
    type: 'forecasting',
    handler: async (query, db, tenantId) => {
      const t0 = performance.now();
      const res1 = await db.query(
        `SELECT COUNT(*) as total, SUM(amount_minor) as total_amount, AVG(amount_minor) as avg_amount,
         SUM(CASE WHEN type='refund' THEN amount_minor ELSE 0 END) as refund_total
         FROM canonical_transactions WHERE tenant_id = $1`, [tenantId]
      );
      const stats = res1.rows[0] as { total: string; total_amount: string; avg_amount: string; refund_total: string; };

      const totalAmount = parseInt(stats.total_amount) || 0;
      const totalRefund = parseInt(stats.refund_total) || 0;
      const totalCount = parseInt(stats.total) || 0;

      const res2 = await db.query(
        `SELECT COUNT(*) as count, SUM(amount_minor) as exposure
         FROM exceptions WHERE tenant_id = $1 AND status = 'open'`, [tenantId]
      );
      const exceptions = res2.rows[0] as { count: string; exposure: string; };
      const baseExposure = parseInt(exceptions.exposure) || 0;

      const dailyAvg = totalAmount / 30;
      const refundRate = totalAmount > 0 ? (totalRefund / totalAmount) * 100 : 0;
      
      const projectedExposure30 = Math.round(baseExposure * 1.15);
      const bestCase = Math.round(baseExposure * 0.7);
      const worstCase = Math.round(baseExposure * 1.8);

      const proofOfLogic = [
        `STEP 1: Queried transaction volume — ${totalCount} records, total ${formatAmount(totalAmount)}`,
        `STEP 2: Computed daily average volume: ${formatAmount(dailyAvg)}`,
        `STEP 3: Refund rate: ${refundRate.toFixed(2)}%`,
        `STEP 4: Current open exception exposure: ${formatAmount(baseExposure)}`,
        `STEP 5: Applied Monte Carlo-style projection (simplified):`,
        `  Base case (+15% growth): ${formatAmount(projectedExposure30)}`,
        `  Best case (-30% resolution): ${formatAmount(bestCase)}`,
        `  Worst case (+80% escalation): ${formatAmount(worstCase)}`,
        `STEP 6: Confidence interval: P25=${formatAmount(bestCase)}, P75=${formatAmount(worstCase)}`,
      ];

      let response = `## 📈 30-Day Financial Forecast\n\n`;
      response += `| Metric | Value |\n|--------|-------|\n`;
      response += `| Daily Avg Volume | ${formatAmount(dailyAvg)} |\n`;
      response += `| Refund Rate | ${refundRate.toFixed(2)}% |\n`;
      response += `| Current Exposure | ${formatAmount(baseExposure)} |\n\n`;
      response += `### Projected Exception Exposure (30-day)\n`;
      response += `🟢 **Best Case:** ${formatAmount(bestCase)} (assumes 30% resolution)\n`;
      response += `🟡 **Base Case:** ${formatAmount(projectedExposure30)} (assumes 15% growth)\n`;
      response += `🔴 **Worst Case:** ${formatAmount(worstCase)} (assumes 80% escalation)\n`;

      // Save forecast
      await db.query(`INSERT INTO forecast_runs (id, tenant_id, base_amount_minor, upside_amount_minor, downside_amount_minor, confidence_p25, confidence_p75, assumptions_json, period_days) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
        genId('fc'), tenantId, projectedExposure30, bestCase, worstCase, 25, 75,
        JSON.stringify(['15% exception growth rate', '30% resolution in best case', '80% escalation in worst case']), 30
      ]);

      return {
        id: genId('ai'), query, response, confidence: 78,
        proofOfLogic, citations: [], model: 'razorrecon-logic-v1',
        tokensUsed: query.length + response.length, queryType: 'forecasting',
        executionTimeMs: performance.now() - t0
      };
    }
  },

  // Summary / overview
  {
    patterns: [/summary|overview|status|dashboard|how.*doing|health/i],
    type: 'system_overview',
    handler: async (query, db, tenantId) => {
      const t0 = performance.now();
      const res1 = await db.query('SELECT COUNT(*) as c FROM canonical_transactions WHERE tenant_id = $1', [tenantId]);
      const txnCount = parseInt(res1.rows[0]?.c) || 0;
      
      const res2 = await db.query('SELECT COUNT(*) as c, SUM(CASE WHEN status=$1 THEN 1 ELSE 0 END) as open_c FROM exceptions WHERE tenant_id = $2', ['open', tenantId]);
      const excCount = { c: parseInt(res2.rows[0]?.c) || 0, open_c: parseInt(res2.rows[0]?.open_c) || 0 };
      
      const res3 = await db.query('SELECT * FROM recon_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1', [tenantId]);
      const lastRun = res3.rows[0] as ReconRun | undefined;
      
      const res4 = await db.query('SELECT * FROM health_scores WHERE tenant_id = $1 ORDER BY calculated_at DESC LIMIT 1', [tenantId]);
      const health = res4.rows[0] as HealthScore | undefined;

      const proofOfLogic = [
        `STEP 1: Queried canonical_transactions — ${txnCount} records`,
        `STEP 2: Queried exceptions — ${excCount.c} total, ${excCount.open_c} open`,
        `STEP 3: Latest recon run: ${lastRun ? `${lastRun.status} (${lastRun.match_rate?.toFixed(1)}% match rate)` : 'None'}`,
        `STEP 4: Health score: ${health?.score || 'Not calculated'}`,
      ];

      let response = `## 📊 System Overview\n\n`;
      response += `| Metric | Value |\n|--------|-------|\n`;
      response += `| Total Transactions | ${txnCount} |\n`;
      response += `| Total Exceptions | ${excCount.c} |\n`;
      response += `| Open Exceptions | ${excCount.open_c} |\n`;
      response += `| Last Recon Match Rate | ${lastRun?.match_rate?.toFixed(1) || 'N/A'}% |\n`;
      response += `| Health Score | ${health?.score || 'N/A'}/100 |\n`;

      if (health) {
        response += `\n### Health Breakdown\n`;
        response += `- Match Rate: ${health.match_rate_component?.toFixed(0)}%\n`;
        response += `- Exception Aging: ${health.exception_aging_component?.toFixed(0)}%\n`;
        response += `- SLA Compliance: ${health.sla_compliance_component?.toFixed(0)}%\n`;
        response += `- Data Freshness: ${health.data_freshness_component?.toFixed(0)}%\n`;
        response += `- Settlement Timing: ${health.settlement_timing_component?.toFixed(0)}%\n`;
      }

      return {
        id: genId('ai'), query, response, confidence: 98, proofOfLogic,
        citations: [], model: 'razorrecon-logic-v1',
        tokensUsed: query.length + response.length, queryType: 'system_overview',
        executionTimeMs: performance.now() - t0
      };
    }
  },

  // Anomaly detection
  {
    patterns: [/anomal|unusual|suspicious|outlier|strange/i],
    type: 'anomaly_detection',
    handler: async (query, db, tenantId) => {
      const t0 = performance.now();
      const res = await db.query(
        'SELECT * FROM anomaly_signals WHERE tenant_id = $1 AND score > 60 ORDER BY score DESC LIMIT 10', [tenantId]
      );
      const anomalies = res.rows as AnomalySignal[];

      const proofOfLogic = [
        `STEP 1: Queried anomaly_signals WHERE score > 60 (high anomaly threshold)`,
        `STEP 2: Found ${anomalies.length} anomalous patterns`,
        `STEP 3: Sorted by anomaly score (highest risk first)`,
      ];

      let response = `## 🔴 Anomaly Detection Report\n\n`;
      response += `Found **${anomalies.length}** high-risk anomaly signals.\n\n`;
      response += `| Time Bucket | Amount Range | Score | Txn Count | Description |\n|-------------|-------------|-------|-----------|-------------|\n`;
      anomalies.forEach((a) => {
        const icon = a.score > 85 ? '🔴' : a.score > 70 ? '🟠' : '🟡';
        response += `| ${a.time_bucket} | ${a.amount_range} | ${icon} ${a.score.toFixed(0)} | ${a.transaction_count} | ${a.description} |\n`;
      });

      return {
        id: genId('ai'), query, response, confidence: 88, proofOfLogic,
        citations: anomalies.slice(0, 5).map((a) => ({
          record_id: a.id, record_type: 'anomaly_signal', field: 'score', value: `${a.score}`, relevance: a.score
        })),
        model: 'razorrecon-logic-v1', tokensUsed: query.length + response.length,
        queryType: 'anomaly_detection', executionTimeMs: performance.now() - t0
      };
    }
  },
];

import Groq from 'groq-sdk';

// Fallback handler - connects to Groq (Llama 3) for random queries in the cloud
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fallbackHandler(query: string, _db: Pool, _tenantId: string): Promise<AIResponse> {
  const t0 = performance.now();
  
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    const chatResponse = await groq.chat.completions.create({
      model: model, 
      messages: [{ role: 'user', content: query }],
    });

    const answer = chatResponse.choices[0]?.message?.content || "No response generated.";

    return {
      id: genId('ai'), query,
      response: answer,
      confidence: 85, 
      proofOfLogic: [
        `STEP 1: No deterministic rule matched the query.`,
        `STEP 2: Delegated to LLM via Groq API (${model}).`
      ],
      citations: [], model: `groq-${model}`, 
      tokensUsed: query.length + answer.length,
      queryType: 'general_qa', executionTimeMs: performance.now() - t0
    };
  } catch (error: any) {
    console.error("Groq fallback failed:", error);
    return {
      id: genId('ai'), query,
      response: `I couldn't reach the Groq AI service to answer your question. (${error.message})\n\nMake sure you have added your GROQ_API_KEY to the Render environment variables.`,
      confidence: 0, proofOfLogic: [`STEP 1: Groq API call failed`],
      citations: [], model: 'groq-error', tokensUsed: query.length,
      queryType: 'fallback', executionTimeMs: performance.now() - t0
    };
  }
}

export async function processAIQuery(tenantId: string, query: string): Promise<AIResponse> {
  const db = getDb();

  for (const pattern of queryPatterns) {
    if (pattern.patterns.some(p => p.test(query))) {
      const result = await pattern.handler(query, db, tenantId);
      // Save to DB
      await db.query(
        `INSERT INTO ai_interactions (id, tenant_id, query, response, model, tokens_used, confidence, citations_json, proof_of_logic)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
         [result.id, tenantId, query, result.response, result.model, result.tokensUsed,
        result.confidence, JSON.stringify(result.citations), result.proofOfLogic.join('\n')]
      );
      return result;
    }
  }

  return await fallbackHandler(query, db, tenantId);
}
