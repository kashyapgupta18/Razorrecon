'use client';
// @ts-nocheck
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

// === Auth Context ===
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          // Not authenticated — redirect to welcome
          router.replace('/welcome');
        }
      })
      .catch(() => {
        router.replace('/welcome');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    router.replace('/welcome');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
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
  { id: 'aurora', label: 'Aurora', colors: ['#042f2e', '#2dd4bf'] },
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

// === Notification Bell ===
function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { events, lastEvent } = useWS();
  const [unreadCount, setUnreadCount] = useState(0);
  const [popups, setPopups] = useState<any[]>([]);

  // Filter events to only meaningful notifications
  const notifications = events.filter(e => 
    e.channel === 'system:notification' || 
    e.channel === 'system:reconciliation' || 
    e.channel === 'system:seed' || 
    (e.channel === 'system:heartbeat' && e.data?.type === 'ai_query')
  );

  // Trigger 2-second popup on new event
  useEffect(() => {
    if (lastEvent && (
      ['system:notification', 'system:reconciliation', 'system:seed'].includes(lastEvent.channel || '') ||
      (lastEvent.channel === 'system:heartbeat' && lastEvent.data?.type === 'ai_query')
    )) {
      if (!isOpen) setUnreadCount(c => c + 1);
      
      // Add to popup
      const popupId = Date.now();
      setPopups(p => [...p, { id: popupId, event: lastEvent }]);
      
      // Auto remove after 2 seconds
      setTimeout(() => {
        setPopups(p => p.filter(item => item.id !== popupId));
      }, 2000);
    }
  }, [lastEvent, isOpen]);

  return (
    <div style={{ position: 'relative', marginLeft: '8px' }}>
      <button 
        className="btn-icon" 
        style={{ position: 'relative', color: 'var(--text-secondary)' }}
        onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '6px', right: '8px', width: '6px', height: '6px', background: 'var(--accent-red)', borderRadius: '50%', boxShadow: '0 0 4px var(--accent-red)' }}></span>
        )}
      </button>

      {/* 2-second Popups */}
      {popups.length > 0 && !isOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '12px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {popups.map(p => {
            let msg = 'System Update';
            if (p.event.channel === 'system:reconciliation') msg = 'Reconciliation Complete';
            if (p.event.channel === 'system:seed') msg = 'Database Seeded';
            if (p.event.data?.type === 'ai_query') msg = 'AI Query Processed';
            
            return (
              <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-purple)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'slideDown 0.2s ease-out' }}>
                <span style={{ color: 'var(--accent-purple)', marginRight: '6px' }}>🔔</span>
                {msg}
              </div>
            );
          })}
        </div>
      )}

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '12px', width: '280px', zIndex: 100, backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-lg)' }}>
            <h4 style={{ fontSize: '14px', margin: '0 0 12px', color: 'var(--text-primary)' }}>Notifications</h4>
            {notifications.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No new notifications
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.slice(0, 10).map((n, i) => (
                  <div key={i} style={{ fontSize: '12px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid var(--accent-purple)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {n.channel === 'system:reconciliation' ? 'Reconciliation Run' : n.channel === 'system:seed' ? 'Database Seeded' : 'System Alert'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {n.data?.type === 'reconciliation_complete' ? `Match Rate: ${n.data.match_rate}%` : n.data?.type === 'ai_query' ? 'AI generated a response' : 'Update received'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// === User Menu ===
function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{ position: 'relative', marginLeft: '8px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 12px 4px 4px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '100px', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-primary)'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
      >
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em'
        }}>
          {initials}
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '8px',
            background: 'var(--bg-card)', border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '220px',
            zIndex: 100, backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-lg)'
          }}>
            {/* User info header */}
            <div style={{ padding: '12px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{user.email}</div>
              <div style={{
                display: 'inline-block', marginTop: '8px', padding: '2px 8px',
                background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                borderRadius: '100px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {user.role}
              </div>
            </div>

            {/* Menu actions */}
            <div style={{ padding: '4px 0' }}>
              <a href="/settings" style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                textDecoration: 'none', transition: 'all 0.2s'
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Settings
              </a>
              <button onClick={() => { setIsOpen(false); logout(); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '8px', color: '#fca5a5', fontSize: '13px', fontWeight: 500,
                background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
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
        <NotificationBell />
        <UserMenu />
        <div className="ws-indicator" style={{ marginLeft: '8px' }}>
          <span className={`ws-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
}

// === Loading Screen ===
function AuthLoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary, #030712)', flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1',
        borderRadius: '50%', animation: 'authSpin 0.8s linear infinite'
      }} />
      <div style={{ color: '#64748b', fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>
        Loading RazorRecon AI...
      </div>
      <style>{`@keyframes authSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
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
    <AuthProvider>
      <AuthGate>
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
      </AuthGate>
    </AuthProvider>
  );
}

// === Auth Gate — shows loading while checking auth ===
function AuthGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
