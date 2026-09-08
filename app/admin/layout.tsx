import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db, usingLocalStore } from '@/lib/db';
import { seedIfEmpty } from '@/lib/seed';
import { config } from '@/lib/config';
import { AdminSidebar } from '@/components/admin/sidebar';
import '../globals.css';

export const metadata = {
  title: { default: 'Internal Dashboard', template: '%s | BookingModel Internal' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (usingLocalStore()) await seedIfEmpty();
  const user = await requireAdmin();

  const [applicants, requests, partnerships, upgrades] = await Promise.all([
    db.count('applicants', { status: 'pending' }),
    db.count('booking_requests', { status: 'new' }),
    db.count('partnership_requests', { status: 'new' }),
    db.count('upgrade_requests', { status: 'pending' }),
  ]);

  const initials = (user.full_name ?? user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="bm-admin" style={{ height: '100vh' }}>
      <div id="app" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div id="topbar">
          <Link href="/admin" className="tb-logo">
            Booking<em>Model</em>
            <span className="tb-badge">INTERNAL</span>
          </Link>

          <div className="tb-view">
            <span>Storage:</span>
            <span className="view-btn on">
              {usingLocalStore() ? 'Local JSON' : 'Supabase'}
            </span>
            <span>Payments:</span>
            <span className="view-btn on">{config.payments.provider}</span>
            <span>Email:</span>
            <span className="view-btn on">{config.email.enabled ? 'Resend' : 'Log only'}</span>
          </div>

          <div className="tb-spacer" />

          <div className="tb-user">
            <Link href="/" className="tb-act">Public site ↗</Link>
            <div className="tb-avatar">{initials}</div>
            <span className="tb-uname">{user.full_name ?? user.email}</span>
            <form action="/api/admin/auth/logout" method="post">
              <button type="submit" className="tb-act">Sign out</button>
            </form>
          </div>
        </div>

        <div id="body">
          <AdminSidebar
            badges={{ applicants, requests, partnerships, upgrades }}
          />
          <div id="main">{children}</div>
        </div>
      </div>
    </div>
  );
}
