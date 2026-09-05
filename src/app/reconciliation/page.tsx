'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CanonicalTransaction, MatchCandidate } from '../../lib/types';
import AppShell, { useWS, useToast } from '../components/AppShell';

const fmt = (v: number) => `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function ReconContent() {
  const [transactions, setTransactions] = useState<CanonicalTransaction[]>([]);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<CanonicalTransaction | null>(null);
  const [filters, setFilters] = useState({ type: '', status: '', method: '' });
  const [reconResult, setReconResult] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [running, setRunning] = useState(false);
  const { lastEvent } = useWS();
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.method) params.set('method', filters.method);
    const [txnRes, matchRes] = await Promise.all([
      fetch(`/api/transactions?${params}`), fetch('/api/matches')
    ]);
    const [txnData, matchData] = await Promise.all([txnRes.json(), matchRes.json()]);
    setTransactions(txnData.transactions || []);
    setMatches(matchData.matches || []);
  }, [filters]);

  // eslint-disable-next-line
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lastEvent?.channel === 'recon:completed') fetchData();
  }, [lastEvent, fetchData]);

  const runRecon = async () => {
    setRunning(true);
    addToast('Starting 7-layer reconciliation engine...', 'info');
    const r = await fetch('/api/reconcile', { method: 'POST' });
    const d = await r.json();
    setRunning(false);
    if (d.success) {
      setReconResult(d);
      addToast(`Reconciliation complete: ${d.matchRate?.toFixed(1)}% match rate, ${d.matched}/${d.totalRecords} matched`, 'success');
      fetchData();
    } else {
      addToast(`Failed: ${d.error}`, 'error');
    }
  };

  const approveMatch = async (id: string, decision: string) => {
    await fetch('/api/matches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision }) });
    addToast(`Match ${decision}`, decision === 'approved' ? 'success' : 'warning');
    fetchData();
  };

  const matchForTxn = (txnId: string) => matches.find(m => m.source_id === txnId || m.target_id === txnId);
  const layerLabel = (type: string) => {
    const map: Record<string, string> = { exact_id: 'L1: Exact ID', exact_amount: 'L2: Amount', net_amount: 'L3: Net Amount', composite_split: 'L4: Composite', fuzzy: 'L6: Fuzzy' };
    return map[type] || type;
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Reconciliation Workspace</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>7-layer deterministic matching with evidence chains</p>
        </div>
        <button className={`btn ${running ? 'btn-secondary' : 'btn-primary'}`} onClick={runRecon} disabled={running}>
          {running ? '⏳ Processing...' : '▶ Run Reconciliation'}
        </button>
      </div>

      {/* Recon Result Banner */}
      {reconResult && (
        <div className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, padding: 16 }}>
          {[
            { label: 'Match Rate', value: `${reconResult.matchRate?.toFixed(1)}%`, color: 'var(--accent-green)' },
            { label: 'Matched', value: reconResult.matched, color: 'var(--accent-blue)' },
            { label: 'Unmatched', value: reconResult.unmatched, color: 'var(--accent-red)' },
            { label: 'Duplicates', value: reconResult.duplicates, color: 'var(--accent-amber)' },
            { label: 'Precision', value: `${reconResult.precision?.toFixed(1)}%`, color: 'var(--accent-cyan)' },
            { label: 'Avg Latency', value: `${reconResult.avgLatencyMs?.toFixed(2)}ms`, color: 'var(--accent-purple)' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <select className="filter-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">All Types</option>
          <option value="payment">Payment</option>
          <option value="settlement">Settlement</option>
          <option value="refund">Refund</option>
        </select>
        <select className="filter-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="captured">Captured</option>
          <option value="settled">Settled</option>
          <option value="refunded">Refunded</option>
          <option value="processing">Processing</option>
        </select>
        <select className="filter-select" value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}>
          <option value="">All Methods</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="netbanking">Netbanking</option>
          <option value="wallet">Wallet</option>
          <option value="neft">NEFT</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{transactions.length} records</span>
      </div>

      {/* Split View: Transactions + Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedTxn ? '1fr 400px' : '1fr', gap: 20 }}>
        {/* Transaction Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th><th>Amount</th><th>Method</th><th>Payment ID</th>
                  <th>Status</th><th>Match</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const match = matchForTxn(txn.id);
                  return (
                    <tr key={txn.id} onClick={() => setSelectedTxn(txn)} style={{ cursor: 'pointer', background: selectedTxn?.id === txn.id ? 'rgba(59,130,246,0.08)' : undefined }}>
                      <td><span className={`badge ${txn.type === 'payment' ? 'badge-info' : txn.type === 'settlement' ? 'badge-success' : 'badge-warning'}`}>{txn.type}</span></td>
                      <td className="mono">{fmt(txn.amount_minor)}</td>
                      <td><span className="badge badge-muted">{txn.method || '—'}</span></td>
                      <td className="mono" style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{txn.payment_id || '—'}</td>
                      <td><span className={`badge ${txn.status === 'captured' ? 'badge-success' : txn.status === 'settled' ? 'badge-info' : 'badge-warning'}`}>{txn.status}</span></td>
                      <td>{match ? <span className="badge badge-success" style={{ fontSize: 10 }}>{layerLabel(match.match_type)} ({match.confidence}%)</span> : <span className="badge badge-danger" style={{ fontSize: 10 }}>Unmatched</span>}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(txn.event_time).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedTxn && (
          <div className="card" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Transaction Detail</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedTxn(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              {[
                ['Type', selectedTxn.type], ['Amount', fmt(selectedTxn.amount_minor)],
                ['Fee', fmt(selectedTxn.fee_minor)], ['Tax', fmt(selectedTxn.tax_minor)],
                ['Net', fmt(selectedTxn.net_minor)], ['Method', selectedTxn.method],
                ['Payment ID', selectedTxn.payment_id], ['Settlement ID', selectedTxn.settlement_id],
                ['UTR', selectedTxn.utr], ['Counterparty', selectedTxn.counterparty],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{val || '—'}</span>
                </div>
              ))}
            </div>

            {/* Match Evidence */}
            {(() => {
              const m = matchForTxn(selectedTxn.id);
              if (!m) return <div style={{ marginTop: 16, padding: 14, background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>⚠ No match found for this transaction</div>;
              const evidence = m.evidence || [];
              return (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Match Evidence — {layerLabel(m.match_type)}</h4>
                  <div style={{ padding: 10, background: 'rgba(16,185,129,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="badge badge-success">Confidence: {m.confidence}%</span>
                      <span className="badge badge-muted">{m.reason_code}</span>
                    </div>
                    {evidence.map((e, i) => (
                      <div key={i} style={{ marginBottom: 8, fontSize: 12 }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{e.field}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono">{e.source_value}</span>
                          <span style={{ color: 'var(--accent-green)' }}>→</span>
                          <span className="mono">{e.target_value}</span>
                        </div>
                        <div style={{ width: '100%', height: 4, background: 'rgba(99,179,237,0.1)', borderRadius: 2, marginTop: 4 }}>
                          <div style={{ width: `${e.match_strength}%`, height: '100%', background: 'var(--gradient-success)', borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {m.decision === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-sm btn-success" onClick={() => approveMatch(m.id, 'approved')}>✓ Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => approveMatch(m.id, 'rejected')}>✕ Reject</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}

export default function ReconciliationPage() {
  return <AppShell currentPath="/reconciliation" title="Reconciliation"><ReconContent /></AppShell>;
}
