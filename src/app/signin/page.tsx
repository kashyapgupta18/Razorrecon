'use client';
// @ts-nocheck

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../auth.css';

export default function SigninPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authContainer">
      <div className="authBgGrid" />
      <div className="authWrapper">
        {/* Left Branding Panel */}
        <div className="authBranding">
          <div className="authBrandLogo">
            <svg viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="url(#authGrad2)" />
              <path d="M13 22l6 6 12-12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="authGrad2" x1="0" y1="0" x2="44" y2="44">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <h1>RazorRecon AI</h1>
          </div>
          <div className="authBrandTagline">Welcome back to your financial command center</div>
          <div className="authBrandDesc">
            Sign in to access your reconciliation dashboard, monitor live transactions, and manage exceptions.
          </div>
          <div className="authFeatures">
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(16,185,129,0.15)' }}>📊</div>
              <div className="authFeatureText">Real-time dashboard & KPIs</div>
            </div>
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(59,130,246,0.15)' }}>🔄</div>
              <div className="authFeatureText">Live transaction monitoring</div>
            </div>
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(245,158,11,0.15)' }}>🔒</div>
              <div className="authFeatureText">Secure session management</div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="authCard">
          <h1 className="authTitle">Welcome Back</h1>
          <p className="authSubtitle">Sign in to continue to your dashboard</p>

          {error && <div className="authError">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="authFormGroup">
              <label className="authLabel" htmlFor="signin-email">Email Address</label>
              <input
                id="signin-email"
                type="email"
                className="authInput"
                placeholder="john@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="authFormGroup">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="authLabel" htmlFor="signin-password" style={{ marginBottom: 0 }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: '0.8rem', color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>Forgot Password?</Link>
              </div>
              <input
                id="signin-password"
                type="password"
                className="authInput"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="authButton" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <Link href="/signup" className="authLink">
            Don&apos;t have an account? <span>Create one</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
