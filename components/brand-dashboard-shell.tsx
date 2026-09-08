'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { SessionUser } from '@/lib/auth';
import { SiteNav } from '@/components/site-nav';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/creators', label: 'Browse Creators' },
  { href: '/dashboard/bookings', label: 'My Campaigns' },
  { href: '/dashboard/campaign-applicants', label: 'Campaign Applicants' },
  { href: '/dashboard/creator-applications', label: 'Creator Applications' },
  { href: '/dashboard/brief', label: 'New Campaign Brief' },
  { href: '/dashboard/plan', label: 'My Plan' },
  { href: '/dashboard/saved', label: 'Saved Creators' },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BrandDashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="brand-dashboard-shell">
      <SiteNav user={user} />

      <div className="brand-dashboard-body">
        <aside className="brand-dashboard-sidebar">
          <div className="brand-dashboard-sidebar-label">Workspace</div>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`brand-dashboard-nav-item${isActive(pathname, item.href) ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}

          <div className="brand-dashboard-sidebar-divider" />
          <div className="brand-dashboard-sidebar-label">Account</div>
          <Link
            href="/dashboard/settings"
            className={`brand-dashboard-nav-item${isActive(pathname, '/dashboard/settings') ? ' active' : ''}`}
          >
            Settings
          </Link>

          <div className="brand-dashboard-sidebar-bottom">
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="brand-dashboard-nav-item brand-dashboard-signout-item">
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <main className="brand-dashboard-main">{children}</main>
      </div>
    </div>
  );
}
