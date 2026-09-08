import Link from 'next/link';
import { db } from '@/lib/db';
import { PLATFORMS, compactNumber, rateLabel } from '@/lib/utils';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import { deleteCreatorAction, updateCreatorStatusAction } from '@/lib/services/admin-actions';
import type { Creator } from '@/lib/types';

export const metadata = { title: 'All Creators' };
const PAGE_SIZE = 20;

export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    platform?: string;
    status?: string;
    notice?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const all = await db.list('creators', { orderBy: 'legacy_id' });
  const q = (sp.q ?? '').trim().toLowerCase();

  const creators = all.filter((c) => {
    if (sp.platform && c.platform !== sp.platform) return false;
    if (sp.status && c.status !== sp.status) return false;
    if (!q) return true;
    return [c.name, c.handle, c.niche, c.contact_email]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(creators.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(sp.page ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleCreators = creators.slice(firstIndex, firstIndex + PAGE_SIZE);
  const firstShown = creators.length === 0 ? 0 : firstIndex + 1;
  const lastShown = Math.min(firstIndex + PAGE_SIZE, creators.length);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.platform) params.set('platform', sp.platform);
    if (sp.status) params.set('status', sp.status);
    params.set('page', String(page));
    return `/admin/creators?${params.toString()}`;
  };

  return (
    <>
      <h1 className="pg-title">All Creators</h1>
      <p className="pg-sub">
        Full database with contact details. {all.length} profiles ·{' '}
        {all.filter((c) => c.status === 'active').length} active ·{' '}
        {all.filter((c) => !c.contact_verified).length} unverified contacts.{' '}
        Showing {firstShown}–{lastShown} of {creators.length} matching creators.
      </p>

      {sp.notice === 'created' && (
        <div className="alert alert-ok" role="status" aria-live="polite">
          Creator added successfully and is now available in the creator database.
        </div>
      )}

      <form className="filter-bar" method="get">
        <input name="q" placeholder="Search name, handle, niche, email…" defaultValue={sp.q ?? ''} />
        <select name="platform" defaultValue={sp.platform ?? ''}>
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ''}>
          <option value="">All statuses</option>
          {['active', 'pending', 'inactive', 'rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" type="submit">Filter</button>
        <Link href="/admin/creators" className="btn btn-ghost btn-sm">Reset</Link>
        <div style={{ marginLeft: 'auto' }}>
          <Link href="/admin/creators/new" className="btn btn-primary btn-sm">➕ Add creator</Link>
        </div>
      </form>

      {creators.length === 0 ? (
        <div className="card empty-state"><span className="ico">🔍</span>No match.</div>
      ) : (
        <div className="creator-grid" aria-label="Creator cards">
          {visibleCreators.map((c) => (
            <article className="creator-card" key={c.id}>
              <Link href={`/admin/creators/${c.id}`} className="creator-card-link">
                <div
                  className="cc-photo"
                  style={{
                    background: c.photo_url
                      ? `#EEE url(${c.photo_url}) center top / cover`
                      : (c.accent_bg ?? 'var(--bg)'),
                  }}
                >
                  {!c.photo_url && <span className="cc-fallback">{c.emoji ?? '👤'}</span>}
                  <div className="cc-photo-overlay" />
                  <span className="cc-platform">{c.platform}</span>
                  {c.status === 'active' ? (
                    <span className="cc-avail">Available</span>
                  ) : (
                    <span className={`cc-status cc-status-${c.status}`}>{c.status}</span>
                  )}
                </div>

                <div className="cc-body">
                  <div className="cc-name">{c.name}</div>
                  <div className="cc-handle">{c.handle}</div>
                  <div className="cc-niche">{c.niche ?? 'Creator profile'}</div>

                  <div className="cc-stats">
                    <div className="cc-stat">
                      <div className="cc-stat-n">{c.audience ?? compactNumber(c.audience_count)}</div>
                      <div className="cc-stat-l">Followers</div>
                    </div>
                    <div className="cc-stat">
                      <div className="cc-stat-n">{c.er ?? '—'}</div>
                      <div className="cc-stat-l">Engagement</div>
                    </div>
                  </div>

                  <div className="cg-row">
                    <div className="cg-rate">{rateLabel(c)} <small>/ video</small></div>
                    <span className="btn-cg">View details</span>
                  </div>
                </div>
              </Link>

              <div className="cc-admin-meta">
                <div className="cc-contact">
                  {c.contact_email ?? 'No contact email'}
                  <span className={c.contact_verified ? 'badge badge-green' : 'badge badge-amber'}>
                    {c.contact_verified ? 'verified' : 'unverified'}
                  </span>
                </div>
                <div className="cc-admin-actions">
                  <Link href={`/admin/creators/${c.id}`} className="btn btn-ghost btn-xs">Edit</Link>
                  <ActionSelect
                    value={c.status}
                    options={['active', 'pending', 'inactive', 'rejected']}
                    action={async (next) => {
                      'use server';
                      return updateCreatorStatusAction(c.id, next as Creator['status']);
                    }}
                  />
                  <ActionButton
                    label="Delete"
                    pendingLabel="Deleting…"
                    className="btn btn-danger btn-xs"
                    confirm={`Delete ${c.name}? This cannot be undone. Creators with booking history cannot be deleted.`}
                    action={async () => {
                      'use server';
                      return deleteCreatorAction(c.id);
                    }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {creators.length > PAGE_SIZE && (
        <nav className="pagination" aria-label="Creator pages">
          <Link
            href={pageHref(currentPage - 1)}
            className={currentPage === 1 ? 'disabled' : undefined}
            aria-label="Previous page"
            aria-disabled={currentPage === 1}
          >
            ←
          </Link>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              href={pageHref(page)}
              className={page === currentPage ? 'on' : undefined}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Link>
          ))}

          <Link
            href={pageHref(currentPage + 1)}
            className={currentPage === totalPages ? 'disabled' : undefined}
            aria-label="Next page"
            aria-disabled={currentPage === totalPages}
          >
            →
          </Link>
        </nav>
      )}
    </>
  );
}
