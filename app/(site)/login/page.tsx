import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { usingLocalStore } from '@/lib/db';
import { LoginForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Brand Login' };

const ERRORS: Record<string, string> = {
  session_expired: 'Your session expired. Please sign in again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, user] = await Promise.all([searchParams, getSessionUser()]);
  // The public login must never become an entry point to the internal admin
  // area. Admin authentication has its own page, cookie and API namespace.
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/admin')
      ? next
      : null;

  if (user) {
    redirect(safeNext ?? '/dashboard');
  }

  return (
    <section className="sec" style={{ maxWidth: 460 }}>
      <div className="sec-eye">Brand access</div>
      <h1 className="sec-h">Sign in to <strong>BookingModel</strong></h1>
      <p className="sec-p">
        Brand accounts unlock verified contact details, campaign tracking and invoices.
      </p>

      <LoginForm next={safeNext ?? undefined} initialError={error ? ERRORS[error] : undefined} />

      {usingLocalStore() && (
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          <strong>Demo accounts</strong> (local JSON store — replaced by real users once Supabase is
          connected):
          <br />
          Admin — <code>{config.seed.adminEmail}</code> / <code>{config.seed.adminPassword}</code>
          <br />
          Brand (Pro) — <code>{config.seed.brandEmail}</code> / <code>{config.seed.brandPassword}</code>
          <br />
          Brand (Standard) — <code>standard@demo.com</code> / <code>StandardDemo123</code>
          <br />
          Brand (Free) — <code>free@demo.com</code> / <code>FreeDemo123</code>
        </div>
      )}
    </section>
  );
}
