'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminLoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Admin sign in failed.');

      router.replace(next ?? '/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin sign in failed.');
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={onSubmit}>
      {error && <div className="admin-login-error">{error}</div>}

      <div className="admin-login-field">
        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          name="email"
          type="email"
          placeholder="admin@bookingmodel.com"
          autoComplete="username"
          required
        />
      </div>

      <div className="admin-login-field">
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      <button className="admin-login-submit" type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in →'}
      </button>
    </form>
  );
}
