'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function EmailVerificationForm({ initialEmail = '' }: { initialEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'We could not verify your email.');

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not verify your email.');
      setSubmitting(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'We could not send a new code.');
      setMessage(data.message ?? 'A new verification code has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send a new code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <form className="form-box" onSubmit={onVerify}>
      <div className="form-title">Verify your email</div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-info" role="status">{message}</div>}

      <div className="fg">
        <label htmlFor="verification-email">Email</label>
        <input
          id="verification-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="fg">
        <label htmlFor="verification-code">Verification code</label>
        <input
          id="verification-code"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          required
        />
        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
          Enter the 6-digit code from the email. It expires in 10 minutes.
        </span>
      </div>

      <button className="submit-btn" type="submit" disabled={submitting || resending}>
        {submitting ? 'Verifying…' : 'Verify email →'}
      </button>
      <button
        className="btn-ghost"
        type="button"
        onClick={resendCode}
        disabled={submitting || resending || !email}
        style={{ width: '100%', marginTop: 10 }}
      >
        {resending ? 'Sending…' : 'Resend code'}
      </button>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
        Need a different email? <Link href="/signup" style={{ color: 'var(--blue)', fontWeight: 700 }}>Start over</Link>
      </p>
    </form>
  );
}
