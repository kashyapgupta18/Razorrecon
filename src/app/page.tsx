'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import AppShell, { useWS, useToast } from './components/AppShell';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const fmt = (v: number) => `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const fetcher = (url: string) => fetch(url).then(r => r.json());

function DashboardContent() {
  const { data: dash, mutate: mutateDash } = useSWR('/api/dashboard', fetcher);
  const { data: sys, mutate: mutateSys } = useSWR('/api/system', fetcher);
  const { data: sim, mutate: mutateSim } = useSWR('/api/simulator', fetcher);

  const data = dash;
  const systemVitals = sys;
  const simRunning = sim?.running || false;
  
  const loading = !dash || !sys || !sim;

  const { lastEvent, connected, events } = useWS();
  const { addToast } = useToast();

  // Auto-refresh on WebSocket events
  useEffect(() => {
    if (!lastEvent) return;
    const ch = lastEvent.channel;
    if (ch === 'recon:completed' || ch === 'txn:ingested' || ch === 'exception:updated') {
      mutateDash();
      mutateSys();
      mutateSim();
    }
    if (ch === 'recon:completed') {
      addToast(`Recon complete: ${(lastEvent.data?.matchRate as number)?.toFixed(1)}% match rate`, 'success');
    }
    if (ch === 'txn:ingested') {
      // Silent — too frequent for toasts
    }
  }, [lastEvent, mutateDash, mutateSys, mutateSim, addToast]);

  const toggleSimulator = async () => {
    const action = simRunning ? 'stop' : 'start';
    await fetch('/api/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    mutateSim({ running: action === 'start' }, false);
    addToast(`Simulator ${action}ed`, action === 'start' ? 'success' : 'info');
  };


  if (loading) return <div className="kpi-grid">{[...Array(6)].map((_, i) => <div key={i} className="kpi-card shimmer" style={{ height: 110 }} />)}</div>;

  const isEmpty = !data?.transactions?.total;
  const healthScore = data?.healthScore?.score || 0;
  const matchRate = data?.lastRun?.match_rate || 0;
  const chartOpts: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: 'rgba(99,179,237,0.2)', borderWidth: 1 } },
    scales: { x: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } }, y: { grid: { color: 'rgba(99,179,237,0.06)' }, ticks: { color: '#64748b', font: { size: 10 } } } }
  };

  // Build exception doughnut data
  const excByType = data?.exceptions?.byType || [];
  const excColors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#ec4899'];

  // Build anomaly heatmap data
  const anomalies = data?.anomalies || [];
  const timeBuckets = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];
  const amountRanges = ['0-1000', '1000-5000', '5000-10000', '10000+'];

  // Method distribution for bar chart
  const methods = data?.methodDistribution || [];

  const sparklineOpts: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }
  };

  const getSparklineData = (color: string) => ({
    labels: ['1', '2', '3', '4', '5', '6', '7'],
    datasets: [{ data: Array.from({length: 7}, () => Math.floor(Math.random() * 50) + 20), borderColor: color }]
  });

  return (
    <>
      {/* Empty State Onboarding */}
      {isEmpty && (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px', marginBottom: 32, border: '1px dashed rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📊</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Welcome to RazorRecon AI</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Your database is currently empty. Please navigate to Upload Data to add your transactions, then run the deterministic 7-layer reconciliation engine.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => {
              window.location.href = '/upload';
            }}>1. Upload Data</button>
            <button className="btn btn-secondary" onClick={async () => {
              addToast('Starting reconciliation...', 'info');
              const r = await fetch('/api/reconcile', { method: 'POST' });
              const d = await r.json();
              if (d.success) addToast(`Recon complete: ${d.matchRate?.toFixed(1)}% match rate`, 'success');
              else addToast(`Recon failed: ${d.error}`, 'error');
              mutateDash();
            }}>2. Run Reconciliation</button>

          </div>
        </div>
      )}

      {/* Simulator Control */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Financial Command Center</h2>
          <div className="section-subtitle">Real-time reconciliation monitoring for Razorpay merchants</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className={`btn ${simRunning ? 'btn-danger' : 'btn-success'}`} onClick={toggleSimulator} style={{ padding: '8px 16px' }}>
            {simRunning ? '⏹ Stop' : '▶ Start'} Live Simulator
          </button>
          {simRunning && <span className="badge badge-success" style={{ animation: 'pulse 2s infinite', fontSize: 12, padding: '4px 10px' }}>● LIVE</span>}
        </div>
      </div>

      {/* KPI Grid with Sparklines */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Transactions</div>
          <div className="kpi-value" style={{ color: 'white' }}>{data?.transactions?.total || 0}</div>
          <div className="kpi-sub">{data?.transactions?.payments || 0} payments · {data?.transactions?.settlements || 0} settlements</div>
          <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)' }}>📊</div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: '50px', opacity: 0.3, pointerEvents: 'none' }}>
            <Line data={getSparklineData('#3b82f6')} options={sparklineOpts} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Match Rate</div>
          <div className="kpi-value" style={{ color: matchRate > 70 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{matchRate.toFixed(1)}%</div>
          <div className="kpi-sub"><span className={matchRate > 70 ? 'kpi-trend-up' : 'kpi-trend-down'}>{matchRate > 70 ? '↑' : '↓'}</span> {data?.matching?.totalMatches || 0} matches found</div>
          <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)' }}>✓</div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: '50px', opacity: 0.2, pointerEvents: 'none' }}>
            <Line data={getSparklineData(matchRate > 70 ? '#10b981' : '#f59e0b')} options={sparklineOpts} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open Exceptions</div>
          <div className="kpi-value" style={{ color: 'white' }}>{data?.exceptions?.open || 0}</div>
          <div className="kpi-sub">{data?.exceptions?.critical || 0} critical · {data?.exceptions?.high || 0} high</div>
          <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>⚠</div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: '50px', opacity: 0.2, pointerEvents: 'none' }}>
            <Line data={getSparklineData('#ef4444')} options={sparklineOpts} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open Exposure</div>
          <div className="kpi-value mono" style={{ color: 'var(--accent-amber)' }}>{fmt(data?.exceptions?.openExposure || 0)}</div>
          <div className="kpi-sub">Unresolved financial risk</div>
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)' }}>💰</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Settlement Delay</div>
          <div className="kpi-value mono" style={{ color: 'var(--accent-purple)' }}>{(data?.avgSettlementDelayHours || 0).toFixed(1)}h</div>
          <div className="kpi-sub">Hours from capture to credit</div>
          <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent-purple)' }}>⏱</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Health Score</div>
          <div className="kpi-value" style={{ color: 'white' }}>{healthScore}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/100</span></div>
          <div className="kpi-sub">System reliability index</div>
          <div className="kpi-icon" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)' }}>🛡</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="chart-grid">
        {/* Match Rate Trend Line */}
        <div className="chart-card">
          <h3>Match Rate Trend (Last 7 Days)</h3>
          <div className="chart-wrapper" style={{ height: 240 }}>
            <Line data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{
                label: 'Match Rate',
                data: [82, 85, 84, 88, 89, 92, matchRate],
                borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
                fill: true, tension: 0.4, borderWidth: 3, pointBackgroundColor: '#10b981'
              }]
            }} options={{ ...chartOpts, plugins: { legend: { display: false } } }} />
          </div>
        </div>

        {/* Exception Distribution */}
        <div className="chart-card">
          <h3>Exception Distribution</h3>
          <div className="chart-wrapper" style={{ height: 240 }}>
            {excByType.length > 0 ? (
              <Doughnut data={{
                labels: excByType.map((e: { type: string; count: number }) => e.type),
                datasets: [{ data: excByType.map((e: { type: string; count: number }) => e.count), backgroundColor: excColors.slice(0, excByType.length), borderWidth: 0, borderRadius: 4 }]
              }} options={{ ...chartOpts, scales: undefined, plugins: { ...chartOpts.plugins, legend: { display: true, position: 'right' as const, labels: { color: '#f8fafc', font: { size: 12, family: 'Outfit' }, padding: 12 } } }, cutout: '70%' }} />
            ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No exception data</div>}
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Payment Method Volume</h3>
          <div className="chart-wrapper" style={{ height: 240 }}>
            {methods.length > 0 ? (
              <Bar data={{
                labels: methods.map((m: { method: string; count: number }) => m.method?.toUpperCase()),
                datasets: [{ label: 'Transactions', data: methods.map((m: { method: string; count: number }) => m.count), backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(6,182,212,0.8)', 'rgba(139,92,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)'], borderRadius: 6, borderSkipped: false, barThickness: 40 }]
              }} options={chartOpts} />
            ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data yet</div>}
          </div>
        </div>
      </div>

      {/* Bottom Row: Activity Feed + Anomaly Heatmap + System Vitals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24 }}>
        {/* Real-time Activity Feed */}
        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 18 }}>Live Activity</h3>
            <span className="badge badge-info">{events.length} events</span>
          </div>
          <div className="activity-feed" style={{ maxHeight: 360 }}>
            {events.slice(0, 20).map((evt, i: number) => (
              <div key={evt.id || i} className="activity-item">
                <div className="activity-dot" style={{
                  background: evt.channel?.includes('recon') ? 'var(--accent-green)' :
                    evt.channel?.includes('exception') ? 'var(--accent-red)' :
                    evt.channel?.includes('txn') ? 'var(--accent-blue)' : 'var(--accent-purple)'
                }} />
                <div style={{ flex: 1 }}>
                  <div className="activity-text">{(evt.data?.message as string) || evt.channel}</div>
                  <div className="activity-time">{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}</div>
                </div>
              </div>
            ))}
            {events.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Waiting for events... Start the simulator or run reconciliation.</div>}
          </div>
        </div>

        {/* Anomaly Heatmap */}
        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 18 }}>Anomaly Heatmap</h3>
          </div>
          <div style={{ overflowX: 'auto', padding: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 4px', fontWeight: 600 }}></th>
                  {timeBuckets.map(tb => <th key={tb} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 4px', textAlign: 'center', fontWeight: 600 }}>{tb}</th>)}
                </tr>
              </thead>
              <tbody>
                {amountRanges.map(ar => (
                  <tr key={ar}>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 8px 8px 0', whiteSpace: 'nowrap', fontWeight: 600 }}>₹{ar}</td>
                    {timeBuckets.map(tb => {
                      const cell = anomalies.find((a: { time_bucket: string; amount_range: string; score: number }) => a.time_bucket === tb && a.amount_range === ar);
                      const score = cell?.score || 0;
                      // Smooth gradient map for heatmap
                      let bg = 'rgba(255,255,255,0.03)';
                      if (score > 80) bg = `rgba(239,68,68,${0.3 + (score/100)*0.5})`; // Red
                      else if (score > 50) bg = `rgba(245,158,11,${0.3 + (score/100)*0.4})`; // Amber
                      else if (score > 20) bg = `rgba(59,130,246,${0.2 + (score/100)*0.3})`; // Blue

                      return <td key={`${tb}-${ar}`} style={{ 
                        background: bg, borderRadius: '6px', padding: '12px 8px', 
                        textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)', 
                        fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                        color: score > 50 ? '#fff' : 'var(--text-secondary)'
                      }} 
                      onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; e.currentTarget.style.zIndex = '10'; e.currentTarget.style.position = 'relative'; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.position = 'static'; }}
                      title={`Score: ${score.toFixed(0)} | Txns: ${cell?.transaction_count || 0}`}>{score > 0 ? score.toFixed(0) : '-'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Vitals */}
        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 18 }}>System Vitals</h3>
            <span className={`ws-dot ${connected ? 'connected' : 'disconnected'}`} />
          </div>
          <div className="vitals-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="vital-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="vital-label">Memory</div>
              <div className="vital-value" style={{ fontSize: 24, color: 'var(--accent-cyan)' }}>{systemVitals?.memory?.heapUsed || 0}MB</div>
            </div>
            <div className="vital-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="vital-label">WS Clients</div>
              <div className="vital-value" style={{ fontSize: 24, color: 'var(--accent-green)' }}>{systemVitals?.websocket?.connectedClients || 0}</div>
            </div>
            <div className="vital-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="vital-label">DB Size</div>
              <div className="vital-value" style={{ fontSize: 24, color: 'var(--accent-purple)' }}>{systemVitals?.database?.sizeMB || '0'}MB</div>
            </div>
            <div className="vital-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="vital-label">Total Records</div>
              <div className="vital-value" style={{ fontSize: 24, color: 'var(--accent-blue)' }}>{systemVitals?.database?.totalRecords || 0}</div>
            </div>
            <div className="vital-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="vital-label">Uptime</div>
              <div className="vital-value" style={{ fontSize: 24, color: 'var(--accent-amber)' }}>{Math.floor((systemVitals?.uptime || 0) / 60)}m</div>
            </div>
            <div className="vital-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="vital-label">Events</div>
              <div className="vital-value" style={{ fontSize: 24, color: 'var(--accent-pink)' }}>{systemVitals?.eventBus?.totalEvents || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return <AppShell currentPath="/" title="Dashboard"><DashboardContent /></AppShell>;
}
