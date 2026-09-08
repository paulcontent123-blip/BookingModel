import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Open Campaigns',
  description: 'Browse active campaigns from verified brands and apply as a creator.',
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const all = await db.list('campaigns', { where: { status: 'active' }, orderBy: 'created_at' });
  const categories = [...new Set(all.map((c) => c.category).filter(Boolean))] as string[];
  const campaigns = cat ? all.filter((c) => c.category === cat) : all;

  return (
    <section className="sec">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="sec-eye">Open Brand Campaigns</div>
          <h1 className="sec-h">Creators — <strong>Apply Now</strong></h1>
          <p className="sec-p">
            Browse active campaigns from verified brands. Click Apply and leave your info.
          </p>
        </div>
        <Link href="/apply" className="btn-hero">Apply as a Creator →</Link>
      </div>

      <div className="mkt-controls">
        <Link className={`filter-sel${!cat ? ' on' : ''}`} href="/campaigns">All categories</Link>
        {categories.map((c) => (
          <Link
            key={c}
            className="filter-sel"
            href={`/campaigns?cat=${encodeURIComponent(c)}`}
            style={cat === c ? { borderColor: 'var(--ink)', color: 'var(--ink)', fontWeight: 700 } : undefined}
          >
            {c}
          </Link>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">
          <span className="ico">📭</span>
          No open campaigns in this category right now.
        </div>
      ) : (
        <div className="camp-grid">
          {campaigns.map((c) => {
            const left = Math.max(0, c.spots_total - c.spots_filled);
            const badge = left === 0 ? 'cb-urgent' : left <= 2 ? 'cb-hot' : 'cb-open';
            return (
              <div className="camp-card" key={c.id}>
                <div className="camp-img" style={{ background: c.accent_bg ?? 'var(--bg2)' }}>
                  {c.emoji ?? '🎬'}
                  <span className={`camp-badge ${badge}`}>
                    {left === 0 ? 'Full' : left <= 2 ? 'Closing soon' : 'Open'}
                  </span>
                </div>
                <div className="camp-body">
                  <div className="camp-brand">{c.brand_name}</div>
                  <div className="camp-title">{c.title}</div>
                  <div className="camp-meta">
                    <span>{c.platform}</span>
                    <span>{c.rate_label}</span>
                  </div>
                  <div className="camp-tags">
                    <span className="camp-tag">{c.category}</span>
                    <span className="camp-tag">{c.content_type}</span>
                  </div>
                  {c.brief_text && (
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.65 }}>
                      {c.brief_text}
                    </p>
                  )}
                  <div className="camp-apply">
                    <span className="camp-spots">
                      {left === 0 ? 'All spots filled' : `${left} spots left`}
                    </span>
                    <Link
                      href={`/apply?campaign=${c.id}`}
                      className="btn-apply"
                      style={left === 0 ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                    >
                      Apply
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
