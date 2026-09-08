'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sign in failed.');

      router.push(next ?? '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
      setSubmitting(false);
    }
  }

  return (
    <form className="form-box" onSubmit={onSubmit}>
      <div className="form-title">Sign in</div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="fg">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="fg">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>

      <button className="submit-btn" type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in →'}
      </button>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
        No account yet? <Link href="/signup" style={{ color: 'var(--blue)', fontWeight: 700 }}>Create one</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.get('full_name'),
          company_name: form.get('company_name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create the account.');

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
      setSubmitting(false);
    }
  }

  return (
    <form className="form-box" onSubmit={onSubmit}>
      <div className="form-title">Create a brand account</div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="fg2">
        <div className="fg">
          <label htmlFor="full_name">Your name *</label>
          <input id="full_name" name="full_name" required autoComplete="name" />
        </div>
        <div className="fg">
          <label htmlFor="company_name">Brand / Company</label>
          <input id="company_name" name="company_name" autoComplete="organization" />
        </div>
      </div>

      <div className="fg">
        <label htmlFor="email">Work email *</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="fg">
        <label htmlFor="password">Password *</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>At least 8 characters.</span>
      </div>

      <button className="submit-btn" type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create account →'}
      </button>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
        Already have an account? <Link href="/login" style={{ color: 'var(--blue)', fontWeight: 700 }}>Sign in</Link>
      </p>
    </form>
  );
}
