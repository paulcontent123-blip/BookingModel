import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Open Campaigns',
  description: 'Browse active campaigns from verified brands and apply as a creator.',
};

const CAMPAIGNS_PER_PAGE = 12;

interface SearchParams {
  q?: string;
  cat?: string;
  platform?: string;
  content?: string;
  page?: string;
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const all = await db.list('campaigns', { where: { status: 'active' }, orderBy: 'created_at' });
  const categories = [...new Set(all.map((c) => c.category).filter(Boolean))]
    .map(String)
    .sort((a, b) => a.localeCompare(b));
  const platforms = [...new Set(all.map((c) => c.platform).filter(Boolean))]
    .map(String)
    .sort((a, b) => a.localeCompare(b));
  const contentTypes = [...new Set(all.map((c) => c.content_type).filter(Boolean))]
    .map(String)
    .sort((a, b) => a.localeCompare(b));
  const q = (sp.q ?? '').trim().toLowerCase();
  const filteredCampaigns = all.filter((campaign) => {
    if (sp.cat && campaign.category !== sp.cat) return false;
    if (sp.platform && campaign.platform !== sp.platform) return false;
    if (sp.content && campaign.content_type !== sp.content) return false;
    if (!q) return true;

    return [
      campaign.brand_name,
      campaign.title,
      campaign.category,
      campaign.platform,
      campaign.content_type,
      campaign.rate_label,
      campaign.brief_text,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });
  const hasFilters = Boolean(sp.q || sp.cat || sp.platform || sp.content);
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / CAMPAIGNS_PER_PAGE));
  const requestedPage = Number.parseInt(sp.page ?? '1', 10);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const campaigns = filteredCampaigns.slice(
    (page - 1) * CAMPAIGNS_PER_PAGE,
    page * CAMPAIGNS_PER_PAGE,
  );
  const rangeStart = campaigns.length ? (page - 1) * CAMPAIGNS_PER_PAGE + 1 : 0;
  const rangeEnd = campaigns.length ? rangeStart + campaigns.length - 1 : 0;

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.cat) params.set('cat', sp.cat);
    if (sp.platform) params.set('platform', sp.platform);
    if (sp.content) params.set('content', sp.content);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    return `/campaigns${query ? `?${query}` : ''}`;
  };

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

      <form className="mkt-controls" method="get" action="/campaigns">
        <input
          className="search-inp"
          type="search"
          name="q"
          placeholder="Search brand, campaign name or brief…"
          defaultValue={sp.q ?? ''}
        />
        <select className="filter-sel" name="cat" defaultValue={sp.cat ?? ''}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select className="filter-sel" name="platform" defaultValue={sp.platform ?? ''}>
          <option value="">All platforms</option>
          {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
        <select className="filter-sel" name="content" defaultValue={sp.content ?? ''}>
          <option value="">All content types</option>
          {contentTypes.map((contentType) => <option key={contentType} value={contentType}>{contentType}</option>)}
        </select>
        <button className="btn-search" type="submit">Search</button>
        {hasFilters && <Link className="btn-ghost" href="/campaigns">Reset</Link>}
      </form>

      <div className="row mb-16" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Showing <strong>{rangeStart}{campaigns.length > 1 ? `–${rangeEnd}` : ''}</strong> of{' '}
          <strong>{filteredCampaigns.length}</strong> matching active campaigns
        </span>
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
                  {c.cover_url && <img className="camp-cover" src={c.cover_url} alt={c.title} />}
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

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Open campaign pages">
          <a
            className={page <= 1 ? 'disabled' : ''}
            href={pageHref(page - 1)}
            aria-label="Previous campaign page"
            aria-disabled={page <= 1}
          >
            Prev
          </a>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            pageNumber === page ? (
              <span className="on" key={pageNumber} aria-current="page">{pageNumber}</span>
            ) : (
              <a key={pageNumber} href={pageHref(pageNumber)}>{pageNumber}</a>
            )
          ))}
          <a
            className={page >= totalPages ? 'disabled' : ''}
            href={pageHref(page + 1)}
            aria-label="Next campaign page"
            aria-disabled={page >= totalPages}
          >
            Next
          </a>
        </nav>
      )}
    </section>
  );
}
