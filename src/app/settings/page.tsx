'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell, { useWS, useToast } from '../components/AppShell';

function SettingsContent() {
  const [systemInfo, setSystemInfo] = useState<Record<string, any> | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { connected } = useWS();
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [sysRes, simRes] = await Promise.all([
        fetch('/api/system'),
        fetch('/api/simulator'),
      ]);
      const [sys, sim] = await Promise.all([sysRes.json(), simRes.json()]);
      setSystemInfo(sys);
      setSimRunning(sim.running);
    } catch {
      addToast('Failed to load system info', 'error');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const r = await fetch('/api/seed', { method: 'POST' });
      const d = await r.json();
      addToast(d.message || 'Database seeded', d.alreadySeeded ? 'info' : 'success');
      fetchData();
    } catch {
      addToast('Seed failed', 'error');
    }
    setSeeding(false);
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      // Reset by dropping and re-seeding
      const r = await fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
      const d = await r.json();
      addToast(d.message || 'Data reset complete', 'success');
      fetchData();
    } catch {
      addToast('Reset failed', 'error');
    }
    setClearing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setUploading(true);
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) throw new Error('Must be an array of transactions');
        
        const r = await fetch('/api/seed-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        const d = await r.json();
        
        if (d.error) {
          addToast(`Upload failed: ${d.error}`, 'error');
        } else {
          addToast(d.message || 'Custom data uploaded successfully', 'success');
          fetchData();
        }
      } catch (err: any) {
        addToast(`Invalid JSON file: ${err.message}`, 'error');
      } finally {
        setUploading(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const toggleSimulator = async () => {
    const action = simRunning ? 'stop' : 'start';
    try {
      await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setSimRunning(!simRunning);
      addToast(`Simulator ${action}ed`, action === 'start' ? 'success' : 'info');
    } catch {
      addToast('Simulator toggle failed', 'error');
    }
  };

  const runRecon = async () => {
    addToast('Starting reconciliation...', 'info');
    try {
      const r = await fetch('/api/reconcile', { method: 'POST' });
      const d = await r.json();
      if (d.success) addToast(`Recon complete: ${d.matchRate?.toFixed(1)}% match rate`, 'success');
      else addToast(`Recon failed: ${d.error}`, 'error');
    } catch {
      addToast('Reconciliation failed', 'error');
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="section-header">
        <div>
          <h2 className="section-title">Settings</h2>
          <div className="section-subtitle">System configuration and data management</div>
        </div>
        <div className="ws-indicator">
          <span className={`ws-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* System Information */}
      <div className="settings-section">
        <h3>🖥️ System Information</h3>
        <div className="card">
          <div className="settings-grid">
            <div className="settings-item">
              <span className="settings-item-label">Platform</span>
              <span className="settings-item-value">{systemInfo?.platform || 'Node.js'}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Node Version</span>
              <span className="settings-item-value">{systemInfo?.nodeVersion || process?.version || '—'}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Uptime</span>
              <span className="settings-item-value" style={{ color: 'var(--accent-green)' }}>
                {formatUptime(systemInfo?.uptime || 0)}
              </span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Heap Used</span>
              <span className="settings-item-value" style={{ color: 'var(--accent-cyan)' }}>
                {systemInfo?.memory?.heapUsed || 0} MB
              </span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Heap Total</span>
              <span className="settings-item-value">{systemInfo?.memory?.heapTotal || 0} MB</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">RSS Memory</span>
              <span className="settings-item-value">{systemInfo?.memory?.rss || 0} MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database */}
      <div className="settings-section">
        <h3>🗄️ Database</h3>
        <div className="card">
          <div className="settings-grid">
            <div className="settings-item">
              <span className="settings-item-label">Provider</span>
              <span className="settings-item-value" style={{ color: 'var(--accent-purple)' }}>
                {(process?.env?.DATABASE_URL || '').includes('supabase') ? 'Supabase' : 'PostgreSQL'}
              </span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Database Size</span>
              <span className="settings-item-value">{systemInfo?.database?.sizeMB || '0'} MB</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Total Records</span>
              <span className="settings-item-value" style={{ color: 'var(--accent-blue)' }}>
                {systemInfo?.database?.totalRecords || 0}
              </span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Transactions</span>
              <span className="settings-item-value">{systemInfo?.database?.tables?.canonical_transactions || 0}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Matches</span>
              <span className="settings-item-value">{systemInfo?.database?.tables?.match_candidates || 0}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Exceptions</span>
              <span className="settings-item-value">{systemInfo?.database?.tables?.exceptions || 0}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Audit Events</span>
              <span className="settings-item-value">{systemInfo?.database?.tables?.audit_events || 0}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Bank Entries</span>
              <span className="settings-item-value">{systemInfo?.database?.tables?.bank_entries || 0}</span>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? '⏳ Seeding...' : '🌱 Seed Synthetic Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Data Upload */}
      <div className="settings-section">
        <h3>📤 Custom Data Upload</h3>
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Upload your own CSV or JSON data and run the reconciliation engine on it. Supports merge (add to existing) and replace modes.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <a href="/upload" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              📤 Go to Upload Page
            </a>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Drag & drop, CSV/JSON support, data preview, column mapping
            </span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Or quick-upload a JSON file here:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input 
                type="file" 
                accept=".json"
                onChange={handleFileUpload}
                disabled={uploading}
                id="custom-data-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="custom-data-upload" className="btn btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                {uploading ? '⏳ Uploading & Processing...' : '📁 Select JSON File'}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* WebSocket & Real-time */}
      <div className="settings-section">
        <h3>📡 Real-time Connection</h3>
        <div className="card">
          <div className="settings-grid">
            <div className="settings-item">
              <span className="settings-item-label">WebSocket Status</span>
              <span className="settings-item-value" style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {connected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Connected Clients</span>
              <span className="settings-item-value">{systemInfo?.websocket?.connectedClients || 0}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Total Events Emitted</span>
              <span className="settings-item-value">{systemInfo?.eventBus?.totalEvents || 0}</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Event Channels</span>
              <span className="settings-item-value">{systemInfo?.eventBus?.channels || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Engine */}
      <div className="settings-section">
        <h3>⚡ Reconciliation Engine</h3>
        <div className="card">
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The 7-layer deterministic reconciliation engine processes transactions through sequential matching layers,
            from exact ID matching to fuzzy date/reference matching, producing evidence chains for every decision.
          </div>
          <div className="settings-grid">
            {[
              { layer: 'L1', name: 'Exact ID Match', desc: 'UTR, Payment ID, Order ID, Settlement ID' },
              { layer: 'L2', name: 'Amount + Currency + Window', desc: '±5 minute time window' },
              { layer: 'L3', name: 'Net Amount Tolerance', desc: 'Fee/tax adjusted, ±₹1 tolerance' },
              { layer: 'L4', name: 'Composite Batch Split', desc: 'Settlement batch decomposition' },
              { layer: 'L5', name: 'Duplicate Detection', desc: 'Payload hash + amount fingerprints' },
              { layer: 'L6', name: 'Fuzzy Date + Reference', desc: 'Description parsing + date proximity' },
              { layer: 'L7', name: 'AI Ranked Candidates', desc: 'ML confidence scoring (future)' },
            ].map(l => (
              <div key={l.layer} className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span className="badge badge-purple" style={{ fontSize: 10, padding: '2px 8px' }}>{l.layer}</span>
                  <span className="settings-item-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.name}</span>
                  <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: 9 }}>ACTIVE</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 4 }}>{l.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={runRecon}>▶ Run Reconciliation Now</button>
          </div>
        </div>
      </div>

      {/* Live Simulator */}
      <div className="settings-section">
        <h3>🔄 Live Transaction Simulator</h3>
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            The simulator generates synthetic payment and settlement transactions at regular intervals,
            injecting them into the pipeline to demonstrate real-time reconciliation capabilities.
          </div>
          <div className="settings-grid" style={{ marginBottom: 16 }}>
            <div className="settings-item">
              <span className="settings-item-label">Simulator Status</span>
              <span className="settings-item-value" style={{ color: simRunning ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {simRunning ? '● Running' : '○ Stopped'}
              </span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Generation Interval</span>
              <span className="settings-item-value">3s</span>
            </div>
          </div>
          <button
            className={`btn ${simRunning ? 'btn-danger' : 'btn-success'}`}
            onClick={toggleSimulator}
          >
            {simRunning ? '⏹ Stop Simulator' : '▶ Start Simulator'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section">
        <div className="danger-zone">
          <h3>⚠️ Danger Zone</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            These actions are destructive and cannot be undone. The database will be cleared and re-seeded with fresh synthetic data.
          </p>
          <button className="btn btn-danger" onClick={handleClearData} disabled={clearing}>
            {clearing ? '⏳ Resetting...' : '🗑 Reset & Re-seed All Data'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return <AppShell currentPath="/settings" title="Settings"><SettingsContent /></AppShell>;
}
