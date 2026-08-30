'use client';
import { useState, useEffect, useRef } from 'react';
import type { AICitation } from '../../lib/types';
import AppShell, { useToast } from '../components/AppShell';

const SUGGESTIONS = [
  'Show critical exceptions',
  'Explain how records are matched',
  'Forecast next 30 days exposure',
  'Give me a system summary',
  'Show anomalies and outliers',
];

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  proofOfLogic?: string[];
  citations?: AICitation[];
  confidence?: number;
  queryType?: string;
  executionTimeMs?: number;
}

function AICopilotContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendQuery = async (query: string) => {
    if (!query.trim()) return;
    // eslint-disable-next-line react-hooks/purity
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch('/api/ai-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const d = await r.json();
      const aiMsg: Message = {
        // eslint-disable-next-line react-hooks/purity
        id: d.id || `ai_${Date.now()}`, role: 'ai', content: d.response || 'No response',
        proofOfLogic: d.proofOfLogic, citations: d.citations, confidence: d.confidence,
        queryType: d.queryType, executionTimeMs: d.executionTimeMs,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      addToast('AI query failed', 'error');
    }
    setLoading(false);
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>AI Copilot</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Proof-of-logic financial intelligence with citation chains</p>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Ask RazorRecon AI anything</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Every answer includes proof-of-logic and citations to real records</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="btn btn-sm btn-secondary" onClick={() => sendQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`chat-msg ${msg.role}`}>
              {msg.role === 'ai' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11 }}>
                  <span className="badge badge-purple">{msg.queryType}</span>
                  <span className="badge badge-info">Confidence: {msg.confidence}%</span>
                  {msg.executionTimeMs && <span className="badge badge-muted">{msg.executionTimeMs.toFixed(1)}ms</span>}
                </div>
              )}

              {/* Render markdown-style content */}
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {msg.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, margin: '8px 0' }}>{line.replace('## ', '')}</h3>;
                  if (line.startsWith('### ')) return <h4 key={i} style={{ fontSize: 13, fontWeight: 600, margin: '6px 0' }}>{line.replace('### ', '')}</h4>;
                  if (line.startsWith('| ')) return <div key={i} className="mono" style={{ fontSize: 11, padding: '2px 0' }}>{line}</div>;
                  if (line.startsWith('- ')) return <div key={i} style={{ paddingLeft: 12, fontSize: 13 }}>• {line.slice(2)}</div>;
                  if (line.startsWith('🟢') || line.startsWith('🟡') || line.startsWith('🔴') || line.startsWith('🎯') || line.startsWith('💰') || line.startsWith('📊') || line.startsWith('🔗') || line.startsWith('🔮')) return <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>{line}</div>;
                  return <span key={i}>{line}{'\n'}</span>;
                })}
              </div>

              {/* Proof of Logic */}
              {msg.proofOfLogic && msg.proofOfLogic.length > 0 && (
                <div className="proof-of-logic">
                  <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--accent-purple)', fontSize: 11, textTransform: 'uppercase' }}>⛓ Proof of Logic</div>
                  {msg.proofOfLogic.map((step, i) => (
                    <div key={i} className="proof-step">{step}</div>
                  ))}
                </div>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>📎 Citations</div>
                  <div className="citation-list">
                    {msg.citations.map((c: AICitation, i: number) => (
                      <span key={i} className="citation-tag">{c.record_type}:{c.record_id?.slice(0, 12)} ({c.relevance}%)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-msg ai" style={{ opacity: 0.6 }}>
              <div className="shimmer" style={{ height: 20, width: 200, marginBottom: 8 }} />
              <div className="shimmer" style={{ height: 14, width: 300 }} />
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        <div className="chat-input-area">
          <input className="chat-input" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && sendQuery(input)}
            placeholder="Ask about exceptions, matches, forecasts, anomalies..." disabled={loading} />
          <button className="btn btn-primary" onClick={() => sendQuery(input)} disabled={loading || !input.trim()}>
            {loading ? '⏳' : '→'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function AICopilotPage() {
  return <AppShell currentPath="/ai-copilot" title="AI Copilot"><AICopilotContent /></AppShell>;
}
