'use client';
// @ts-nocheck

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../components/AppShell';
import '../auth.css';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
  
  // Step 1 State
  const [email, setEmail] = useState('');
  
  // Step 2 State
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        addToast(data.message || 'OTP sent successfully. Please check your email.', 'success');
        setStep(2);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid or expired OTP');
      } else {
        addToast('Password reset successfully. Please sign in.', 'success');
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
          <div className="authBrandTagline">Secure Account Recovery</div>
          <div className="authBrandDesc">
            Reset your password securely with a one-time verification code sent to your registered email.
          </div>
          <div className="authFeatures">
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(59,130,246,0.15)' }}>🛡️</div>
              <div className="authFeatureText">Encrypted verification</div>
            </div>
            <div className="authFeature">
              <div className="authFeatureIcon" style={{ background: 'rgba(16,185,129,0.15)' }}>⏱️</div>
              <div className="authFeatureText">Code expires in 15 mins</div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="authCard">
          <h1 className="authTitle">Forgot Password</h1>
          <p className="authSubtitle">
            {step === 1 ? 'Enter your registered email ID' : 'Enter the OTP sent to your email'}
          </p>

          {error && <div className="authError">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp}>
              <div className="authFormGroup">
                <label className="authLabel" htmlFor="reset-email">Registered Email ID</label>
                <input
                  id="reset-email"
                  type="email"
                  className="authInput"
                  placeholder="john@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="authButton" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="authFormGroup">
                <label className="authLabel" htmlFor="reset-otp">6-Digit OTP</label>
                <input
                  id="reset-otp"
                  type="text"
                  className="authInput"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                />
              </div>

              <div className="authFormGroup">
                <label className="authLabel" htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  className="authInput"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button type="submit" className="authButton" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <Link href="/signin" className="authLink">
            Remembered your password? <span>Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
