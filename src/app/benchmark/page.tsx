'use client';
import { useState } from 'react';
import AppShell, { useToast } from '../components/AppShell';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const fmt = (v: number) => `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

interface BenchmarkReport {
  total_records: number; matched: number; unmatched: number; duplicates_detected: number;
  match_rate: number; precision: number; recall: number; f1_score: number;
  false_positives: number; false_negatives: number;
  avg_latency_ms: number; p50_latency_ms: number; p95_latency_ms: number;
  idempotency_passed: boolean;
  results: Array<{
    record_id: string; expected_outcome: string; actual_outcome: string;
    confidence: number; evidence_summary: string; processing_time_ms: number;
    resolution_status: string; correct: boolean;
  }>;
  unresolved_exceptions: Array<{
    record_id: string; type: string; reason: string;
    evidence_missing: string; amount_minor: number; currency: string;
  }>;
}

function BenchmarkContent() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'results' | 'exceptions'>('overview');
  const { addToast } = useToast();

  const runBenchmark = async () => {
    setLoading(true);
    try {
      // Ensure data is seeded first
      await fetch('/api/seed', { method: 'POST' });
      addToast('Running benchmark suite...', 'info');
      const r = await fetch('/api/benchmark', { method: 'POST' });
      const d = await r.json();
      if (d.success) {
        setReport(d.report);
        addToast(`Benchmark complete: F1=${d.report.f1_score.toFixed(1)}%`, 'success');
      } else {
        addToast(`Benchmark failed: ${d.error}`, 'error');
      }
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      addToast(`Error: ${e.message}`, 'error');
    }
    setLoading(false);
  };

  // === Confusion Matrix Computation ===
  const computeConfusionMatrix = () => {
    if (!report) return { tp: 0, fp: 0, fn: 0, tn: 0 };
    const results = report.results;
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of results) {
      const expected = r.expected_outcome !== 'UNMATCHED';
      const actual = r.actual_outcome !== 'UNMATCHED';
      if (expected && actual) tp++;
      else if (!expected && actual) fp++;
      else if (expected && !actual) fn++;
      else tn++;
    }
    return { tp, fp, fn, tn };
  };

  const chartOpts: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: 'rgba(99,179,237,0.2)', borderWidth: 1 } },
    scales: { x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } }, y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } } }
  };

  if (!report) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🧪</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Benchmark Suite</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 500, margin: '0 auto 32px' }}>
          Run the full reconciliation engine against 60+ synthetic records with ground-truth labels.
          Measures precision, recall, F1 score, latency percentiles, and idempotency.
        </p>
        <button className="btn btn-primary" onClick={runBenchmark} disabled={loading}
          style={{ padding: '12px 32px', fontSize: 15 }}>
          {loading ? '⏳ Running...' : '▶ Run Full Benchmark'}
        </button>
        {loading && (
          <div style={{ marginTop: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            <div className="shimmer" style={{ width: 300, height: 6, borderRadius: 3, margin: '16px auto' }} />
            Seeding data → Running 7-layer engine → Computing metrics...
          </div>
        )}
      </div>
    );
  }

  const cm = computeConfusionMatrix();
  const accuracy = report.results.length > 0
    ? ((report.results.filter(r => r.correct).length / report.results.length) * 100) : 0;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Benchmark Report</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {report.total_records} records evaluated · {report.matched} matched · {report.unmatched} unmatched
          </p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={runBenchmark} disabled={loading}>
          {loading ? '⏳ Re-running...' : '↻ Re-run Benchmark'}
        </button>
      </div>

      {/* Score Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Match Rate</div>
          <div className="kpi-value" style={{ color: report.match_rate > 70 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
            {report.match_rate.toFixed(1)}%
          </div>
          <div className="kpi-sub">{report.matched}/{report.total_records} matched</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Precision</div>
          <div className="kpi-value mono" style={{ color: 'var(--accent-blue)' }}>{report.precision.toFixed(1)}%</div>
          <div className="kpi-sub">True positives / all positives</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Recall</div>
          <div className="kpi-value mono" style={{ color: 'var(--accent-cyan)' }}>{report.recall.toFixed(1)}%</div>
          <div className="kpi-sub">True positives / actual matches</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">F1 Score</div>
          <div className="kpi-value mono" style={{ color: report.f1_score > 70 ? 'var(--accent-green)' : 'var(--accent-amber)', fontSize: 28 }}>
            {report.f1_score.toFixed(1)}%
          </div>
          <div className="kpi-sub">Harmonic mean of P & R</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Accuracy</div>
          <div className="kpi-value mono" style={{ color: 'var(--accent-purple)' }}>{accuracy.toFixed(1)}%</div>
          <div className="kpi-sub">{report.results.filter(r => r.correct).length}/{report.results.length} correct</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Latency</div>
          <div className="kpi-value mono" style={{ color: 'var(--accent-amber)' }}>{report.avg_latency_ms.toFixed(2)}ms</div>
          <div className="kpi-sub">P95: {report.p95_latency_ms.toFixed(2)}ms</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['overview', 'results', 'exceptions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600,
              background: 'transparent', border: 'none', color: tab === t ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent',
              cursor: 'pointer', textTransform: 'capitalize'
            }}>{t === 'exceptions' ? `Exceptions (${report.unresolved_exceptions.length})` : t}</button>
        ))}
      </div>

      {/* === OVERVIEW TAB === */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {/* Confusion Matrix */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Confusion Matrix</h3>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 10, color: 'var(--text-muted)', padding: 6 }}></th>
                  <th style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 6, textAlign: 'center' }}>Pred: Match</th>
                  <th style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 6, textAlign: 'center' }}>Pred: No Match</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 6, fontWeight: 600 }}>Actual: Match</td>
                  <td style={{ background: 'rgba(16,185,129,0.15)', borderRadius: 6, textAlign: 'center', padding: 16, fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-green)' }}>
                    {cm.tp}
                    <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>TP</div>
                  </td>
                  <td style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 6, textAlign: 'center', padding: 16, fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-red)' }}>
                    {cm.fn}
                    <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>FN</div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 6, fontWeight: 600 }}>Actual: No Match</td>
                  <td style={{ background: 'rgba(245,158,11,0.12)', borderRadius: 6, textAlign: 'center', padding: 16, fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)' }}>
                    {cm.fp}
                    <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>FP</div>
                  </td>
                  <td style={{ background: 'rgba(59,130,246,0.12)', borderRadius: 6, textAlign: 'center', padding: 16, fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {cm.tn}
                    <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>TN</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Outcome Distribution (Doughnut) */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Outcome Distribution</h3>
            <div style={{ height: 200 }}>
              <Doughnut
                data={{
                  labels: ['Matched', 'Unmatched', 'Duplicates'],
                  datasets: [{
                    data: [report.matched, report.unmatched, report.duplicates_detected],
                    backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'],
                    borderWidth: 0, borderRadius: 4
                  }]
                }}
                options={{
                  ...chartOpts, scales: undefined,
                  plugins: { ...chartOpts.plugins, legend: { display: true, position: 'bottom' as const, labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } },
                  cutout: '60%'
                }}
              />
            </div>
          </div>

          {/* Latency Profile (Bar) */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Latency Profile</h3>
            <div style={{ height: 200 }}>
              <Bar
                data={{
                  labels: ['Avg', 'P50', 'P95'],
                  datasets: [{
                    data: [report.avg_latency_ms, report.p50_latency_ms, report.p95_latency_ms],
                    backgroundColor: ['#3b82f6', '#06b6d4', '#f59e0b'],
                    borderRadius: 6, borderSkipped: false
                  }]
                }}
                options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, title: { display: true, text: 'ms', color: '#64748b', font: { size: 10 } } } } }}
              />
            </div>
          </div>

          {/* Summary Stats */}
          <div className="card" style={{ gridColumn: 'span 3' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Detailed Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
              {[
                { label: 'Total Records', value: report.total_records, color: 'var(--accent-blue)' },
                { label: 'True Positives', value: cm.tp, color: 'var(--accent-green)' },
                { label: 'False Positives', value: report.false_positives, color: 'var(--accent-amber)' },
                { label: 'False Negatives', value: report.false_negatives, color: 'var(--accent-red)' },
                { label: 'Duplicates', value: report.duplicates_detected, color: 'var(--accent-purple)' },
                { label: 'Idempotency', value: report.idempotency_passed ? '✓ PASS' : '✕ FAIL', color: report.idempotency_passed ? 'var(--accent-green)' : 'var(--accent-red)' },
              ].map(m => (
                <div key={m.label} className="vital-card">
                  <div className="vital-label">{m.label}</div>
                  <div className="vital-value" style={{ fontSize: 20, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === RESULTS TAB === */}
      {tab === 'results' && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Record ID', 'Expected', 'Actual', 'Correct', 'Confidence', 'Latency', 'Status', 'Evidence'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.results.map((r, i) => (
                <tr key={r.record_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(99,179,237,0.02)' }}>
                  <td className="mono" style={{ padding: '8px', fontSize: 11, color: 'var(--text-secondary)' }}>{r.record_id.slice(0, 16)}...</td>
                  <td><span className="badge" style={{ background: r.expected_outcome === 'MATCH' ? 'rgba(16,185,129,0.12)' : r.expected_outcome === 'UNMATCHED' ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.12)', color: r.expected_outcome === 'MATCH' ? 'var(--accent-green)' : r.expected_outcome === 'UNMATCHED' ? 'var(--accent-red)' : 'var(--accent-purple)', fontSize: 10 }}>{r.expected_outcome}</span></td>
                  <td><span className="badge" style={{ background: r.actual_outcome === 'MATCH' ? 'rgba(16,185,129,0.12)' : r.actual_outcome === 'UNMATCHED' ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.12)', color: r.actual_outcome === 'MATCH' ? 'var(--accent-green)' : r.actual_outcome === 'UNMATCHED' ? 'var(--accent-red)' : 'var(--accent-purple)', fontSize: 10 }}>{r.actual_outcome}</span></td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{r.correct ? <span style={{ color: 'var(--accent-green)' }}>✓</span> : <span style={{ color: 'var(--accent-red)' }}>✕</span>}</td>
                  <td className="mono" style={{ padding: '8px', color: r.confidence >= 90 ? 'var(--accent-green)' : r.confidence >= 70 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>{r.confidence.toFixed(0)}%</td>
                  <td className="mono" style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.processing_time_ms.toFixed(2)}ms</td>
                  <td><span className="badge" style={{ fontSize: 10 }}>{r.resolution_status}</span></td>
                  <td style={{ padding: '8px', fontSize: 11, color: 'var(--text-muted)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.evidence_summary}>{r.evidence_summary.slice(0, 60)}{r.evidence_summary.length > 60 ? '...' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === EXCEPTIONS TAB === */}
      {tab === 'exceptions' && (
        <div className="card" style={{ overflow: 'auto' }}>
          {report.unresolved_exceptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No unresolved exceptions</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Record ID', 'Type', 'Amount', 'Reason', 'Missing Evidence'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.unresolved_exceptions.map((e, i) => (
                  <tr key={e.record_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(99,179,237,0.02)' }}>
                    <td className="mono" style={{ padding: '8px', fontSize: 11, color: 'var(--text-secondary)' }}>{e.record_id.slice(0, 16)}...</td>
                    <td><span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', fontSize: 10 }}>{e.type}</span></td>
                    <td className="mono" style={{ padding: '8px', color: 'var(--accent-amber)' }}>{fmt(e.amount_minor)}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)', maxWidth: 250 }}>{e.reason}</td>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 11 }}>{e.evidence_missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

export default function BenchmarkPage() {
  return <AppShell currentPath="/benchmark" title="Benchmark"><BenchmarkContent /></AppShell>;
}
