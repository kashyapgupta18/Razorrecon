'use client';
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface WebSocketEvent {
  channel?: string;
  type?: string;
  id?: string;
  timestamp?: string | number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

// === WebSocket Context ===
interface WSContextType {
  connected: boolean;
  lastEvent: WebSocketEvent | null;
  events: WebSocketEvent[];
  send: (data: unknown) => void;
}

const WSContext = createContext<WSContextType>({ connected: false, lastEvent: null, events: [], send: () => {} });
export const useWS = () => useContext(WSContext);

function WSProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => { setConnected(true); setWs(socket); };
      socket.onclose = () => { setConnected(false); setWs(null); reconnectTimer = setTimeout(connect, 3000); };
      socket.onerror = () => { socket.close(); };
      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          setLastEvent(event);
          setEvents(prev => [event, ...prev].slice(0, 100));
        } catch {}
      };
    };

    connect();
    return () => { socket?.close(); clearTimeout(reconnectTimer); };
  }, []);

  const send = useCallback((data: unknown) => { ws?.send(JSON.stringify(data)); }, [ws]);

  return <WSContext.Provider value={{ connected, lastEvent, events, send }}>{children}</WSContext.Provider>;
}

// === Toast Context ===
interface Toast { id: string; message: string; type: 'success' | 'warning' | 'error' | 'info'; }
const ToastContext = createContext<{ addToast: (msg: string, type: Toast['type']) => void }>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `t_${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// === Sidebar ===
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { href: '/reconciliation', label: 'Reconciliation', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href: '/money-flow', label: 'Money Flow', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/exceptions', label: 'Exceptions', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z', badge: true },
  { href: '/audit-trail', label: 'Audit Trail', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/ai-copilot', label: 'AI Copilot', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5' },
  { href: '/benchmark', label: 'Benchmark', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM12 15a3 3 0 100-6 3 3 0 000 6z' },
];

function Sidebar({ collapsed, onToggle, currentPath }: { collapsed: boolean; onToggle: () => void; currentPath: string }) {
  const [excCount, setExcCount] = useState(0);

  useEffect(() => {
    fetch('/api/exceptions').then(r => r.json()).then(d => {
      setExcCount(d.exceptions?.filter((e: { status: string }) => e.status === 'open').length || 0);
    }).catch(() => {});
  }, []);

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <svg viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="url(#lg)" />
          <path d="M8 14l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <defs><linearGradient id="lg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#3b82f6"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
        </svg>
        <div>
          <h1>RazorRecon AI</h1>
          <div className="logo-sub">Enterprise Platform</div>
        </div>
      </div>
      <div className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <a key={item.href} href={item.href}
            className={`nav-item ${currentPath === item.href ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
            <span className="nav-label">{item.label}</span>
            {item.badge && excCount > 0 && <span className="nav-badge">{excCount}</span>}
          </a>
        ))}
      </div>
      <div className="sidebar-footer">
        <button onClick={onToggle} className="nav-item" style={{ width: '100%' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
            <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
          </svg>
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </nav>
  );
}

// === Command Palette ===
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const commands = [
    { label: 'Go to Dashboard', desc: 'View KPIs and metrics', action: () => { router.push('/'); }, shortcut: 'G D' },
    { label: 'Go to Reconciliation', desc: 'Match transactions', action: () => { router.push('/reconciliation'); }, shortcut: 'G R' },
    { label: 'Go to Exceptions', desc: 'View exception queue', action: () => { router.push('/exceptions'); }, shortcut: 'G E' },
    { label: 'Go to AI Copilot', desc: 'Ask questions', action: () => { router.push('/ai-copilot'); }, shortcut: 'G A' },
    { label: 'Go to Benchmark', desc: 'Run benchmark tests', action: () => { router.push('/benchmark'); }, shortcut: 'G B' },
    { label: 'Run Reconciliation', desc: 'Trigger recon engine', action: () => { fetch('/api/reconcile', { method: 'POST' }); onClose(); }, shortcut: '⌘ R' },
    { label: 'Seed Database', desc: 'Load synthetic data', action: () => { fetch('/api/seed', { method: 'POST' }); onClose(); }, shortcut: '⌘ S' },
    { label: 'Start Simulator', desc: 'Live transaction feed', action: () => { fetch('/api/simulator', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({action:'start'}) }); onClose(); }, shortcut: '⌘ L' },
    { label: 'Stop Simulator', desc: 'Stop live feed', action: () => { fetch('/api/simulator', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({action:'stop'}) }); onClose(); } },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => { 
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(''); 
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <input className="cmd-input" placeholder="Type a command..." value={query} onChange={e => setQuery(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && filtered[0]) { filtered[0].action(); onClose(); } }} />
        <div className="cmd-results">
          {filtered.map((cmd, i) => (
            <div key={i} className="cmd-item" onClick={() => { cmd.action(); onClose(); }}>
              <div className="cmd-item-icon">⚡</div>
              <div>
                <div className="cmd-item-label">{cmd.label}</div>
                <div className="cmd-item-desc">{cmd.desc}</div>
              </div>
              {cmd.shortcut && <span className="cmd-shortcut">{cmd.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const THEMES = [
  { id: 'dark', label: 'Dark', colors: ['#040914', '#3b82f6'] },
  { id: 'light', label: 'Light', colors: ['#f8fafc', '#2563eb'] },
  { id: 'cyberpunk', label: 'Cyberpunk', colors: ['#0a0014', '#ec4899'] },
];

function ThemeSwitcher() {
  const [theme, setTheme] = useState('cyberpunk');
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'cyberpunk';
    setTheme(saved);
  }, []);

  const handleSelect = (val: string) => {
    setTheme(val);
    localStorage.setItem('theme', val);
    document.documentElement.setAttribute('data-theme', val);
    setIsOpen(false);
  };

  const activeTheme = THEMES.find(t => t.id === theme) || THEMES[2];

  return (
    <div style={{ position: 'relative', marginLeft: '8px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="filter-select" 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}
      >
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: `linear-gradient(135deg, ${activeTheme.colors[0]} 50%, ${activeTheme.colors[1]} 50%)`, border: '1px solid rgba(255,255,255,0.2)' }} />
        {activeTheme.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '6px', minWidth: '160px', zIndex: 100, backdropFilter: 'blur(16px)', boxShadow: 'var(--shadow-lg)' }}>
            {THEMES.map(t => (
              <button 
                key={t.id} 
                onClick={() => handleSelect(t.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', background: theme === t.id ? 'rgba(255,255,255,0.05)' : 'transparent', color: theme === t.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: theme === t.id ? 600 : 500, transition: 'all 0.2s', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = theme === t.id ? 'rgba(255,255,255,0.05)' : 'transparent'}
              >
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: `linear-gradient(135deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)`, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// === Top Bar ===
function TopBar({ title }: { title: string }) {
  const { connected } = useWS();
  const { addToast } = useToast();

  const handleSeed = async () => {
    const r = await fetch('/api/seed', { method: 'POST' });
    const d = await r.json();
    addToast(d.message, d.alreadySeeded ? 'info' : 'success');
  };

  const handleRecon = async () => {
    addToast('Starting reconciliation...', 'info');
    const r = await fetch('/api/reconcile', { method: 'POST' });
    const d = await r.json();
    if (d.success) addToast(`Recon complete: ${d.matchRate?.toFixed(1)}% match rate`, 'success');
    else addToast(`Recon failed: ${d.error}`, 'error');
  };

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        RazorRecon <span style={{ margin: '0 4px' }}>/</span> <span>{title}</span>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <ThemeSwitcher />
        <button className="btn btn-sm btn-secondary" onClick={handleSeed}>Seed Data</button>
        <button className="btn btn-sm btn-primary" onClick={handleRecon}>▶ Run Recon</button>
        <button className="btn-icon" style={{ position: 'relative', marginLeft: '8px', color: 'var(--text-secondary)' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span style={{ position: 'absolute', top: '6px', right: '8px', width: '6px', height: '6px', background: 'var(--accent-red)', borderRadius: '50%', boxShadow: '0 0 4px var(--accent-red)' }}></span>
        </button>
        <div className="ws-indicator" style={{ marginLeft: '8px' }}>
          <span className={`ws-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
}

// === Main Layout Shell ===
export default function AppShell({ children, currentPath, title }: { children: ReactNode; currentPath: string; title: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v); }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <WSProvider>
      <ToastProvider>
        <div className="app-layout">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} currentPath={currentPath} />
          <div className={`app-main ${collapsed ? 'collapsed' : ''}`}>
            <TopBar title={title} />
            <div className="page-content fade-in">{children}</div>
          </div>
          <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        </div>
      </ToastProvider>
    </WSProvider>
  );
}
