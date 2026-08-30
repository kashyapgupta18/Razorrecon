'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Exception, ExceptionComment } from '../../lib/types';
import AppShell, { useWS, useToast } from '../components/AppShell';

const fmt = (v: number) => `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const COLUMNS = [
  { key: 'open', label: 'Open', color: 'var(--accent-red)' },
  { key: 'investigating', label: 'Investigating', color: 'var(--accent-amber)' },
  { key: 'escalated', label: 'Escalated', color: 'var(--accent-purple)' },
  { key: 'resolved', label: 'Resolved', color: 'var(--accent-green)' },
];

function ExceptionsContent() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [selected, setSelected] = useState<Exception | null>(null);
  const [comment, setComment] = useState('');
  const { lastEvent } = useWS();
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    const r = await fetch('/api/exceptions');
    const d = await r.json();
    setExceptions(d.exceptions || []);
  }, []);

  // eslint-disable-next-line
  useEffect(() => { fetchData(); }, [fetchData]);
  // eslint-disable-next-line
  useEffect(() => { if (lastEvent?.channel === 'exception:updated') fetchData(); }, [lastEvent, fetchData]);

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/exceptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    addToast(`Exception ${status}`, status === 'resolved' ? 'success' : 'info');
    fetchData();
    if (selected?.id === id) setSelected((s) => s ? ({ ...s, status: status as Exception['status'] }) : null);
  };

  const addComment = async () => {
    if (!selected || !comment.trim()) return;
    await fetch('/api/exceptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, comment }) });
    setComment('');
    fetchData();
    addToast('Comment added', 'success');
  };

  const sevIcon = (s: string) => s === 'critical' ? '🔴' : s === 'high' ? '🟠' : s === 'medium' ? '🟡' : '🟢';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Exception Command Center</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>SLA-tracked exception resolution with audit trails</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {COLUMNS.slice(0, 3).map(c => {
            const count = exceptions.filter(e => e.status === c.key).length;
            return <span key={c.key} className="badge" style={{ background: `${c.color}15`, color: c.color }}>{c.label}: {count}</span>;
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        {/* Kanban Board */}
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colExceptions = exceptions.filter(e => e.status === col.key);
            return (
              <div key={col.key} className="kanban-column">
                <div className="kanban-header">
                  <span style={{ color: col.color }}>{col.label}</span>
                  <span className="kanban-count">{colExceptions.length}</span>
                </div>
                {colExceptions.map(exc => (
                  <div key={exc.id} className="kanban-card" onClick={() => setSelected(exc)}
                    style={{ borderLeft: `3px solid ${col.color}`, background: selected?.id === exc.id ? 'rgba(59,130,246,0.08)' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{sevIcon(exc.severity)} {exc.type}</span>
                      <span className="mono" style={{ fontSize: 11, color: col.color }}>{fmt(exc.amount_minor)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4, maxHeight: 32, overflow: 'hidden' }}>{exc.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>{exc.transaction?.type || exc.type}</span>
                      <span>{exc.counterparty?.slice(0, 15) || '—'}</span>
                    </div>
                    {exc.sla_deadline && col.key !== 'resolved' && (
                      <div style={{ marginTop: 6, fontSize: 10, color: new Date(exc.sla_deadline) < new Date() ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                        ⏱ SLA: {new Date(exc.sla_deadline).toLocaleDateString()}
                        {new Date(exc.sla_deadline) < new Date() && ' ⚠ BREACHED'}
                      </div>
                    )}
                  </div>
                ))}
                {colExceptions.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No items</div>}
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Exception Detail</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ fontSize: 13, display: 'grid', gap: 8 }}>
              {[
                ['ID', selected.id], ['Type', selected.type], ['Severity', `${sevIcon(selected.severity)} ${selected.severity}`],
                ['Amount', fmt(selected.amount_minor)], ['Status', selected.status],
                ['Payment ID', selected.payment_id], ['Method', selected.method],
                ['Counterparty', selected.counterparty], ['Created', new Date(selected.created_at).toLocaleString()],
              ].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{v || '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, padding: 10, background: 'rgba(99,179,237,0.05)', borderRadius: 'var(--radius-sm)' }}>{selected.description}</div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              {selected.status === 'open' && <>
                <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(selected.id, 'investigating')}>🔍 Investigate</button>
                <button className="btn btn-sm btn-danger" onClick={() => updateStatus(selected.id, 'escalated')}>⬆ Escalate</button>
              </>}
              {(selected.status === 'investigating' || selected.status === 'open') && <button className="btn btn-sm btn-success" onClick={() => updateStatus(selected.id, 'resolved')}>✓ Resolve</button>}
              {selected.status === 'escalated' && <button className="btn btn-sm btn-success" onClick={() => updateStatus(selected.id, 'resolved')}>✓ Resolve</button>}
            </div>

            {/* Comments */}
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Comments</h4>
              {(selected.comments || []).map((c: ExceptionComment) => (
                <div key={c.id} style={{ padding: 8, marginBottom: 6, background: 'rgba(99,179,237,0.04)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.user_name}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{c.comment}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="chat-input" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }} placeholder="Add comment..." value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
                <button className="btn btn-sm btn-primary" onClick={addComment}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function ExceptionsPage() {
  return <AppShell currentPath="/exceptions" title="Exceptions"><ExceptionsContent /></AppShell>;
}
