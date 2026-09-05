'use client';


import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../auth.css';

function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '#475569' };
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;

    const levels = [
      { label: '', color: '#475569' },
      { label: 'Weak', color: '#ef4444' },
      { label: 'Fair', color: '#f59e0b' },
      { label: 'Good', color: '#f59e0b' },
      { label: 'Strong', color: '#10b981' },
      { label: 'Very Strong', color: '#06b6d4' },
    ];
    return { score: s, ...(levels[s] || levels[0]) };
  }, [password]);

  if (!password) return null;

  return (
    <>
      <div className="passwordStrength">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`passwordStrengthBar ${i <= score ? 'active' : ''}`}
            style={{ '--strength-color': color } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="passwordStrengthLabel" style={{ color }}>{label}</div>
    </>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        router.push('/signin');
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
              <rect width="44" height="44" rx="10" fill="url(#authGrad)" />
              <path d="M13 22l6 6 12-12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="authGrad" x1="0" y1="0" x2="44" y2="44">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <h1>RazorRecon AI</h1>
          </div>
          <div className="authBrandTagline">Enterprise-grade reconciliation powered by AI</div>
          <div className="authBrandDesc">
            Join thousands of merchants who trust RazorRecon AI to automate financial reconciliation with 99.9% accuracy.
          </div>
          <div className="authFeatures">
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(59,130,246,0.15)' }}>🤖</div>
              <div className="authFeatureText">7-layer AI matching engine</div>
            </div>
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(16,185,129,0.15)' }}>⚡</div>
              <div className="authFeatureText">Real-time transaction streaming</div>
            </div>
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(139,92,246,0.15)' }}>🛡️</div>
              <div className="authFeatureText">Autonomous exception resolution</div>
            </div>
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(245,158,11,0.15)' }}>📊</div>
              <div className="authFeatureText">Complete audit trail & compliance</div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="authCard">
          <h1 className="authTitle">Create Account</h1>
          <p className="authSubtitle">Start reconciling in under 2 minutes</p>

          {error && <div className="authError">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="authFormGroup">
              <label className="authLabel" htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                className="authInput"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="authFormGroup">
              <label className="authLabel" htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                className="authInput"
                placeholder="john@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="authFormGroup">
              <label className="authLabel" htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                className="authInput"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
              <PasswordStrength password={formData.password} />
            </div>

            <button type="submit" className="authButton" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <Link href="/signin" className="authLink">
            Already have an account? <span>Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
