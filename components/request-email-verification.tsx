'use client';

import { useState } from 'react';

export interface VerifiedRequestResponse {
  id?: string;
  request_ref?: string;
}

export function RequestEmailVerification({
  email,
  verificationId,
  onVerified,
  onChangeEmail,
  className = 'form-box',
}: {
  email: string;
  verificationId: string;
  onVerified: (result: VerifiedRequestResponse) => void;
  onChangeEmail: () => void;
  className?: string;
}) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/request-email-verification/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'We could not confirm your email.');
      onVerified(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not confirm your email.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/request-email-verification/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'We could not send a new code.');
      setMessage('A new verification code has been sent.');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send a new code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={className}>
      <div className="form-title">Confirm your email</div>
      <p className="summary-note" style={{ marginTop: 0 }}>
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below to save your request.
        You must be able to access this inbox.
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-ok">{message}</div>}
      <form onSubmit={verify}>
        <div className="fg">
          <label htmlFor="request-email-code">Verification code</label>
          <input
            id="request-email-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="123456"
          />
        </div>
        <button className="submit-btn" type="submit" disabled={submitting || resending}>
          {submitting ? 'Confirming…' : 'Confirm email →'}
        </button>
      </form>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn-ghost" type="button" onClick={resend} disabled={submitting || resending}>
          {resending ? 'Sending…' : 'Resend code'}
        </button>
        <button className="btn-ghost" type="button" onClick={onChangeEmail} disabled={submitting || resending}>
          Use a different email
        </button>
      </div>
      <p className="summary-note" style={{ textAlign: 'center', marginBottom: 0 }}>
        The code expires in 10 minutes.
      </p>
    </div>
  );
}
