'use client';
// @ts-nocheck

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './welcome.css';

export default function WelcomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          router.replace('/');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="welcomePage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="welcomePage">
      {/* Ambient Background */}
      <div className="welcomeBg" />
      <div className="welcomeGrid" />
      <div className="welcomeOrb welcomeOrb1" />
      <div className="welcomeOrb welcomeOrb2" />
      <div className="welcomeOrb welcomeOrb3" />

      {/* Navigation */}
      <nav className="welcomeNav">
        <div className="welcomeNavLogo">
          <svg viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="url(#wlg)" />
            <path d="M10 18l5 5 10-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="wlg" x1="0" y1="0" x2="36" y2="36">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <span>RazorRecon AI</span>
        </div>
        <div className="welcomeNavActions">
          <Link href="/signin" className="welcomeNavBtn welcomeNavBtnGhost">Sign In</Link>
          <Link href="/signup" className="welcomeNavBtn welcomeNavBtnPrimary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="welcomeHero">
        <div className="welcomeBadge">
          AI-Powered Financial Reconciliation
        </div>

        <h1 className="welcomeTitle">
          Reconcile Payments{' '}
          <span className="welcomeTitleGradient">Instantly with AI</span>
        </h1>

        <p className="welcomeSubtitle">
          RazorRecon AI automates your Razorpay payment reconciliation with a 7-layer matching engine, 
          real-time monitoring, and autonomous exception resolution — all in one platform.
        </p>

        <div className="welcomeHeroActions">
          <Link href="/signup" className="welcomeHeroBtn welcomeHeroBtnPrimary">
            Start Free →
          </Link>
          <Link href="/signin" className="welcomeHeroBtn welcomeHeroBtnSecondary">
            Sign In to Dashboard
          </Link>
        </div>

        <div className="welcomeStats">
          <div className="welcomeStat">
            <div className="welcomeStatValue">99.9%</div>
            <div className="welcomeStatLabel">Match Accuracy</div>
          </div>
          <div className="welcomeStat">
            <div className="welcomeStatValue">&lt;2s</div>
            <div className="welcomeStatLabel">Processing Time</div>
          </div>
          <div className="welcomeStat">
            <div className="welcomeStatValue">7</div>
            <div className="welcomeStatLabel">AI Matching Layers</div>
          </div>
          <div className="welcomeStat">
            <div className="welcomeStatValue">24/7</div>
            <div className="welcomeStatLabel">Live Monitoring</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="welcomeFeatures">
        <h2 className="welcomeSectionTitle">Everything You Need</h2>
        <p className="welcomeSectionSub">Enterprise-grade tools for seamless financial reconciliation</p>

        <div className="welcomeFeatureGrid">
          <div className="welcomeFeatureCard" style={{ '--card-accent': 'rgba(59,130,246,0.4)' } as React.CSSProperties}>
            <div className="welcomeFeatureIcon" style={{ background: 'rgba(59,130,246,0.12)' }}>🤖</div>
            <div className="welcomeFeatureTitle">AI Reconciliation Engine</div>
            <div className="welcomeFeatureDesc">
              7-layer deterministic matching with ML-powered anomaly detection. Automatically matches payments, settlements, and bank entries.
            </div>
          </div>

          <div className="welcomeFeatureCard" style={{ '--card-accent': 'rgba(16,185,129,0.4)' } as React.CSSProperties}>
            <div className="welcomeFeatureIcon" style={{ background: 'rgba(16,185,129,0.12)' }}>⚡</div>
            <div className="welcomeFeatureTitle">Real-Time Streaming</div>
            <div className="welcomeFeatureDesc">
              WebSocket-powered live transaction feed with instant reconciliation. Watch your financial data reconcile in real time.
            </div>
          </div>

          <div className="welcomeFeatureCard" style={{ '--card-accent': 'rgba(245,158,11,0.4)' } as React.CSSProperties}>
            <div className="welcomeFeatureIcon" style={{ background: 'rgba(245,158,11,0.12)' }}>⚠️</div>
            <div className="welcomeFeatureTitle">Exception Management</div>
            <div className="welcomeFeatureDesc">
              Smart exception queue with SLA tracking, automated resolution suggestions, and complete audit trail for compliance.
            </div>
          </div>

          <div className="welcomeFeatureCard" style={{ '--card-accent': 'rgba(139,92,246,0.4)' } as React.CSSProperties}>
            <div className="welcomeFeatureIcon" style={{ background: 'rgba(139,92,246,0.12)' }}>💬</div>
            <div className="welcomeFeatureTitle">AI Copilot</div>
            <div className="welcomeFeatureDesc">
              Ask questions in natural language. Get instant insights about your financial data with explainable AI responses.
            </div>
          </div>

          <div className="welcomeFeatureCard" style={{ '--card-accent': 'rgba(6,182,212,0.4)' } as React.CSSProperties}>
            <div className="welcomeFeatureIcon" style={{ background: 'rgba(6,182,212,0.12)' }}>💰</div>
            <div className="welcomeFeatureTitle">Money Flow Visualization</div>
            <div className="welcomeFeatureDesc">
              Sankey diagrams and flow charts showing exactly how money moves through your Razorpay ecosystem.
            </div>
          </div>

          <div className="welcomeFeatureCard" style={{ '--card-accent': 'rgba(236,72,153,0.4)' } as React.CSSProperties}>
            <div className="welcomeFeatureIcon" style={{ background: 'rgba(236,72,153,0.12)' }}>📊</div>
            <div className="welcomeFeatureTitle">Benchmark & Analytics</div>
            <div className="welcomeFeatureDesc">
              Performance benchmarks, health scores, and predictive analytics to keep your reconciliation running at peak efficiency.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="welcomeFooter">
        © {new Date().getFullYear()} RazorRecon AI — Enterprise Reconciliation Platform
      </footer>
    </div>
  );
}
