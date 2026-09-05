'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell, { useWS, useToast } from '../components/AppShell';

interface AuditEvent {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface FilterOptions {
  actions: string[];
  entities: string[];
  actors: string[];
}

const ACTION_COLORS: Record<string, { bg: string; color: string; icon: string }> = {
  create: { bg: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', icon: '＋' },
  insert: { bg: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', icon: '＋' },
  seed: { bg: 'rgba(6,182,212,0.12)', color: 'var(--accent-cyan)', icon: '🌱' },
  update: { bg: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', icon: '✎' },
  delete: { bg: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', icon: '🗑' },
  match: { bg: 'rgba(139,92,246,0.12)', color: 'var(--accent-purple)', icon: '🔗' },
  reconcile: { bg: 'rgba(139,92,246,0.12)', color: 'var(--accent-purple)', icon: '⚡' },
  resolve: { bg: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', icon: '✓' },
  escalate: { bg: 'rgba(245,158,11,0.12)', color: 'var(--accent-amber)', icon: '⬆' },
  query: { bg: 'rgba(6,182,212,0.12)', color: 'var(--accent-cyan)', icon: '🤖' },
  login: { bg: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', icon: '🔑' },
  export: { bg: 'rgba(236,72,153,0.12)', color: 'var(--accent-pink)', icon: '📤' },
};

function getActionStyle(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return ACTION_COLORS[key || ''] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', icon: '•' };
}

function AuditTrailContent() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ actions: [], entities: [], actors: [] });
  const [filters, setFilters] = useState({ action: '', entity: '', actor: '', search: '' });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const { lastEvent } = useWS();
  const { addToast } = useToast();
  const PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.entity) params.set('entity', filters.entity);
      if (filters.actor) params.set('actor', filters.actor);
      if (filters.search) params.set('search', filters.search);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const r = await fetch(`/api/audit-trail?${params}`);
      const d = await r.json();
      setEvents(d.events || []);
      setTotal(d.total || 0);
      setFilterOptions(d.filters || { actions: [], entities: [], actors: [] });
    } catch {
      addToast('Failed to load audit trail', 'error');
    }
    setLoading(false);
  }, [filters, page, addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (lastEvent?.channel?.includes('audit') || lastEvent?.channel?.includes('recon') || lastEvent?.channel?.includes('exception')) {
      fetchData();
    }
  }, [lastEvent, fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h2 className="section-title">Audit Trail</h2>
          <div className="section-subtitle">Complete immutable log of all system actions</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge badge-info">{total} events</span>
          <button className="btn btn-sm btn-secondary" onClick={() => { setPage(0); fetchData(); }}>↻ Refresh</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="filter-select"
          placeholder="🔍 Search events..."
          value={filters.search}
          onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }}
          style={{ minWidth: 200, background: 'rgba(255,255,255,0.03)' }}
        />
        <select className="filter-select" value={filters.action} onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0); }}>
          <option value="">All Actions</option>
          {filterOptions.actions.map(a => <option key={a} value={a}>{formatAction(a)}</option>)}
        </select>
        <select className="filter-select" value={filters.entity} onChange={e => { setFilters(f => ({ ...f, entity: e.target.value })); setPage(0); }}>
          <option value="">All Entities</option>
          {filterOptions.entities.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="filter-select" value={filters.actor} onChange={e => { setFilters(f => ({ ...f, actor: e.target.value })); setPage(0); }}>
          <option value="">All Actors</option>
          {filterOptions.actors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(filters.action || filters.entity || filters.actor || filters.search) && (
          <button className="btn btn-sm btn-secondary" onClick={() => { setFilters({ action: '', entity: '', actor: '', search: '' }); setPage(0); }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
        {/* Timeline */}
        <div className="card" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="shimmer" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>No audit events found</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {total === 0 ? 'Upload data and run reconciliation to generate audit events.' : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <div className="timeline" style={{ padding: '8px 16px' }}>
              {events.map((evt, i) => {
                const style = getActionStyle(evt.action);
                return (
                  <div
                    key={evt.id}
                    className="timeline-item"
                    onClick={() => setSelected(evt)}
                    style={{
                      cursor: 'pointer',
                      animationDelay: `${i * 30}ms`,
                      background: selected?.id === evt.id ? 'rgba(59,130,246,0.06)' : undefined,
                      paddingLeft: 8, paddingRight: 8,
                    }}
                  >
                    <div className="timeline-dot" style={{ color: style.color, background: style.color }} />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span
                          className="badge"
                          style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 700 }}
                        >
                          {style.icon} {formatAction(evt.action)}
                        </span>
                        <span className="timeline-actor">{evt.actor}</span>
                        <span className="timeline-time">{formatTime(evt.created_at)}</span>
                      </div>
                      <div className="timeline-body">
                        {evt.entity_type && (
                          <span className="timeline-entity">
                            {evt.entity_type}
                            {evt.entity_id && <span style={{ color: 'var(--accent-blue)' }}>:{evt.entity_id.slice(0, 12)}</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
              padding: '16px', borderTop: '1px solid var(--border-glass)',
            }}>
              <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Event Detail</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ fontSize: 13, display: 'grid', gap: 8 }}>
              {[
                ['Event ID', selected.id],
                ['Action', formatAction(selected.action)],
                ['Actor', selected.actor],
                ['Entity Type', selected.entity_type],
                ['Entity ID', selected.entity_id],
                ['Tenant', selected.tenant_id],
                ['Timestamp', new Date(selected.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'long' })],
              ].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                  <span className="mono" style={{ fontSize: 12, textAlign: 'right', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v || '—'}</span>
                </div>
              ))}
            </div>

            {/* Details JSON */}
            {selected.details && Object.keys(selected.details).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Event Payload
                </h4>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)', padding: 14,
                  fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6,
                  color: 'var(--text-secondary)', overflow: 'auto', maxHeight: 300,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {JSON.stringify(selected.details, null, 2)}
                </div>
              </div>
            )}

            {/* Action Badge */}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(() => {
                const style = getActionStyle(selected.action);
                return (
                  <span className="badge" style={{ background: style.bg, color: style.color, fontSize: 12, padding: '6px 14px' }}>
                    {style.icon} {formatAction(selected.action)}
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AuditTrailPage() {
  return <AppShell currentPath="/audit-trail" title="Audit Trail"><AuditTrailContent /></AppShell>;
}
