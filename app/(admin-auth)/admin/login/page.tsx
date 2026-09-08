import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin-login-form';
import { getAdminSessionUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { usingLocalStore } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  admin_required: 'This area is for admin accounts. Brand accounts use the public login.',
  session_expired: 'Your admin session expired. Please sign in again.',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, user] = await Promise.all([searchParams, getAdminSessionUser()]);
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  if (user) redirect(safeNext ?? '/admin');

  return (
    <main className="admin-login-screen">
      <section className="admin-login-box" aria-label="Admin sign in">
        <div className="admin-login-logo">
          Booking<em>Model</em>{' '}
          <span>Internal</span>
        </div>
        <div className="admin-login-subtitle">VEA Group — Admin Access</div>

        <AdminLoginForm
          next={safeNext ?? undefined}
          initialError={error ? ERRORS[error] ?? 'Please sign in with an admin account.' : undefined}
        />

        <p className="admin-login-note">
          Only accounts with the <strong>admin</strong> role can sign in here.
        </p>

        {usingLocalStore() && (
          <div className="admin-login-demo">
            Admin: <code>{config.seed.adminEmail}</code> / <code>{config.seed.adminPassword}</code>
          </div>
        )}
      </section>
    </main>
  );
}
