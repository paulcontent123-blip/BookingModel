'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { SessionUser } from '@/lib/auth';

const SOLUTIONS = [
  { slug: 'ugc', icon: '🎬', title: 'On-Demand UGC', sub: 'Videos & AI creation at scale' },
  { slug: 'influencer', icon: '🤝', title: 'Influencer Marketing', sub: 'End-to-end campaign management' },
  { slug: 'ecommerce', icon: '🛒', title: 'E-Commerce Service', sub: 'TikTok Shop, Amazon, Shopify' },
  { slug: 'advertising', icon: '📢', title: 'Advertising', sub: 'TikTok Ads & Meta Ads managed' },
  { slug: 'production', icon: '🎥', title: 'Production & Livestream', sub: 'Studio, events, live commerce' },
  { slug: 'brand', icon: '🎯', title: 'Brand Identity & SEO', sub: 'Strategy, identity, growth' },
];

export function SiteNav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [closeUntilMouseLeaves, setCloseUntilMouseLeaves] = useState(false);
  const on = (href: string) => (pathname.startsWith(href) ? 'nl on' : 'nl');

  function closeSolutionsAfterSelection() {
    setSolutionsOpen(false);
    // The cursor is still over the parent after a submenu click. Suppress the
    // CSS hover state until it leaves so the dropdown does not stay visible on
    // the newly loaded page.
    setCloseUntilMouseLeaves(true);
  }

  return (
    <nav>
      <Link href="/" className="logo">
        <div className="logo-mark">
          <svg viewBox="0 0 20 20">
            <path d="M10 2L3 5.5v5c0 4.2 3 7.8 7 8.8 4-1 7-4.6 7-8.8v-5L10 2z" />
          </svg>
        </div>
        <div className="logo-text">
          Booking<em>Model</em>
        </div>
      </Link>

      <div className="nav-c">
        <Link href="/" className={pathname === '/' ? 'nl on' : 'nl'}>Home</Link>
        <Link href="/marketplace" className={on('/marketplace')}>Marketplace</Link>

        <div
          className={`nav-drop${solutionsOpen ? ' open' : ''}${closeUntilMouseLeaves ? ' suppressed' : ''}`}
          onMouseEnter={() => {
            setCloseUntilMouseLeaves(false);
            setSolutionsOpen(true);
          }}
          onMouseLeave={() => {
            setSolutionsOpen(false);
          }}
        >
          <Link
            href="/solutions"
            className={`${on('/solutions')} nl-arr`}
            aria-haspopup="menu"
            aria-expanded={solutionsOpen && !closeUntilMouseLeaves}
            onClick={closeSolutionsAfterSelection}
          >
            Solutions
          </Link>
          <div className="ddm">
            {SOLUTIONS.map((s) => (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="ddi"
                onClick={closeSolutionsAfterSelection}
              >
                <span className="ddi-ico">{s.icon}</span>
                <span className="ddi-text">
                  <span className="ddi-title">{s.title}</span>
                  <span className="ddi-sub">{s.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <Link href="/campaigns" className={on('/campaigns')}>Open Campaigns</Link>
        <Link href="/news" className={on('/news')}>News &amp; Showcase</Link>
        <Link href="/partnership" className={on('/partnership')}>Partnership</Link>
        <Link href="/contact" className={on('/contact')}>Contact</Link>
      </div>

      <div className="nav-r">
        {user ? (
          <>
            {user.role === 'admin' && (
              <Link href="/admin" className="btn-ghost">Admin</Link>
            )}
            <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
            <Link href="/contact" className="btn-blue">Request Campaign</Link>
          </>
        ) : (
          <>
            <Link href="/login" className="btn-ghost">Brand Login</Link>
            <Link href="/contact" className="btn-blue">Request Campaign</Link>
          </>
        )}
      </div>
    </nav>
  );
}
