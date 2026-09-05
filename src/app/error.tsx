'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global unhandled error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: '2rem'
    }}>
      <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: 600 }}>Something went wrong!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px', lineHeight: '1.5' }}>
          We encountered an unexpected error while rendering this page. Our engineers have been notified.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            className="btn-primary" 
            onClick={() => reset()}
          >
            Try again
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
