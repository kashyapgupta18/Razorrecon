'use client';

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
      <div className="authCard">
        <h1 className="authTitle">RazorRecon AI</h1>
        <p className="authSubtitle">Welcome back! Please sign in.</p>

        {error && <div className="authError">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="authFormGroup">
            <label className="authLabel" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="authInput"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="authFormGroup">
            <label className="authLabel" htmlFor="password">Password</label>
            <input
              id="password"
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
          Don't have an account? <span>Create one now</span>
        </Link>
      </div>
    </div>
  );
}
