'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Item {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  tone?: 'blue' | 'amber' | 'green';
}

export function AdminSidebar({
  badges,
}: {
  badges: {
    applicants: number;
    campaignApplicants: number;
    requests: number;
    partnerships: number;
    upgrades: number;
  };
}) {
  const pathname = usePathname();

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Overview',
      items: [{ href: '/admin', icon: '📊', label: 'Dashboard' }],
    },
    {
      title: 'Creator database',
      items: [
        { href: '/admin/creators', icon: '👥', label: 'All Creators' },
        { href: '/admin/creators/new', icon: '➕', label: 'Add Creator' },
        { href: '/admin/import', icon: '📥', label: 'Import / Excel Sync' },
        {
          href: '/admin/applicants',
          icon: '📝',
          label: 'KOL/KOC Applicants',
          badge: badges.applicants,
          tone: 'amber',
        },
        {
          href: '/admin/campaign-applicants',
          icon: '🎯',
          label: 'Campaign Applicants',
          badge: badges.campaignApplicants,
          tone: 'blue',
        },
      ],
    },
    {
      title: 'Revenue',
      items: [
        { href: '/admin/deals', icon: '💼', label: 'Booking Deals' },
        { href: '/admin/invoices', icon: '🧾', label: 'Invoices' },
        {
          href: '/admin/booking-requests',
          icon: '🌏',
          label: 'Regional Requests',
          badge: badges.requests,
          tone: 'blue',
        },
        {
          href: '/admin/upgrade-requests',
          icon: '💳',
          label: 'Plan Upgrades',
          badge: badges.upgrades,
          tone: 'amber',
        },
      ],
    },
    {
      title: 'Campaigns & leads',
      items: [
        { href: '/admin/campaigns', icon: '🚀', label: 'All Campaigns' },
        {
          href: '/admin/partnership',
          icon: '🤝',
          label: 'Partnership Requests',
          badge: badges.partnerships,
          tone: 'green',
        },
        { href: '/admin/messages', icon: '✉️', label: 'Contact Messages' },
      ],
    },
    {
      title: 'System',
      items: [
        { href: '/admin/emails', icon: '📮', label: 'Email Log' },
        { href: '/admin/settings', icon: '⚙️', label: 'Settings & Keys' },
      ],
    },
  ];

  const isOn = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div id="sidebar">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="sb-section">{section.title}</div>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sb-item${isOn(item.href) ? ' on' : ''}`}
            >
              <span className="sb-ico">{item.icon}</span>
              <span>{item.label}</span>
              {!!item.badge && (
                <span className={`sb-badge ${item.tone ?? 'blue'}`}>{item.badge}</span>
              )}
            </Link>
          ))}
          <div className="sb-sep" />
        </div>
      ))}
    </div>
  );
}
