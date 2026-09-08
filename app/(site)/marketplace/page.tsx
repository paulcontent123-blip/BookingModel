import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { CreatorCard } from '@/components/creator-card';
import { CATEGORIES, PLATFORMS, TIERS } from '@/lib/utils';
import type { Creator } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Creator Marketplace',
  description: 'Browse 140,000+ vetted food and lifestyle creators on TikTok, Instagram, YouTube and Facebook.',
};

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  platform?: string;
  category?: string;
  tier?: string;
  page?: string;
}

function filterCreators(all: Creator[], sp: SearchParams): Creator[] {
  const q = (sp.q ?? '').trim().toLowerCase();

  return all.filter((c) => {
    if (sp.platform && c.platform !== sp.platform) return false;
    if (sp.category && c.category !== sp.category) return false;
    if (sp.tier && c.tier !== sp.tier) return false;
    if (!q) return true;
    return [c.name, c.handle, c.niche, c.category, c.platform, c.bio]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  });
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [all, user] = await Promise.all([
    db.list('creators', { where: { status: 'active' }, orderBy: 'legacy_id' }),
    getSessionUser(),
  ]);

  const filtered = filterCreators(all, sp);
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const qs = (overrides: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/marketplace?${s}` : '/marketplace';
  };

  return (
    <section className="sec">
      <div className="sec-eye">140,000+ Vetted Creators</div>
      <h1 className="sec-h">Creator <strong>Marketplace</strong></h1>
      <p className="sec-p">
        Every creator is vetted by hand — no self-serve sign-ups, no algorithmic matching. Rates and
        audience data are verified before a profile goes live.
      </p>

      <form className="mkt-controls" method="get" action="/marketplace">
        <input
          className="search-inp"
          type="search"
          name="q"
          placeholder="Search name, handle or niche…"
          defaultValue={sp.q ?? ''}
        />
        <select className="filter-sel" name="platform" defaultValue={sp.platform ?? ''}>
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-sel" name="category" defaultValue={sp.category ?? ''}>
          <option value="">All niches</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-sel" name="tier" defaultValue={sp.tier ?? ''}>
          <option value="">Any size</option>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-search" type="submit">Search</button>
        {(sp.q || sp.platform || sp.category || sp.tier) && (
          <Link className="btn-ghost" href="/marketplace">Reset</Link>
        )}
      </form>

      <div className="row mb-16" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Showing <strong>{shown.length}</strong> of <strong>{filtered.length}</strong> creators
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>
          Basic creator information is public. Full contact details are available in the Brand dashboard
          for Standard and Pro accounts —{' '}
          <Link
            href={user ? '/dashboard/creators' : '/login'}
            style={{ color: 'var(--blue)', fontWeight: 700 }}
          >
            {user ? 'Open dashboard' : 'Sign in as Brand'}
          </Link>
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <span className="ico">🔍</span>
          No creator matches those filters. Try widening your search.
        </div>
      ) : (
        <div className="creator-grid">
          {shown.map((c) => <CreatorCard key={c.id} creator={c} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="pagination">
          <Link className={page <= 1 ? 'disabled' : ''} href={qs({ page: String(page - 1) })}>Prev</Link>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
            p === page ? (
              <span className="on" key={p}>{p}</span>
            ) : (
              <Link key={p} href={qs({ page: String(p) })}>{p}</Link>
            ),
          )}
          <Link className={page >= pages ? 'disabled' : ''} href={qs({ page: String(page + 1) })}>Next</Link>
        </div>
      )}
    </section>
  );
}
