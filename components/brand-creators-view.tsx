import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser, revealedCreatorIdsToday, revealQuota } from '@/lib/auth';
import {
  lowestPlanWith,
  planHasFeature,
  planName,
  revealLimitLabel,
  upgradeTargets,
} from '@/lib/plans';
import { rateLabel } from '@/lib/utils';
import { RevealContactButton } from '@/components/reveal-contact-button';

export interface BrandCreatorSearchParams {
  q?: string;
  platform?: string;
  category?: string;
  /** Advanced filters — only applied for plans that include them. */
  min_er?: string;
  max_rate?: string;
  page?: string;
}

const PAGE_SIZE = 20;

function rateFrom(creator: Parameters<typeof rateLabel>[0]) {
  return rateLabel(creator).split('–')[0]?.trim() || '—';
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function BrandCreatorsView({
  searchParams = {},
}: {
  searchParams?: BrandCreatorSearchParams;
}) {
  const user = await requireUser();

  const [all, quota, revealedToday] = await Promise.all([
    db.list('creators', { where: { status: 'active' }, orderBy: 'legacy_id' }),
    revealQuota(user),
    revealedCreatorIdsToday(user.id),
  ]);

  const canFilterAdvanced = user.role === 'admin' || planHasFeature(user.plan, 'advanced_filters');
  const contactPlan = planName(lowestPlanWith('contact_reveals') ?? 'standard');
  const nextPlan = upgradeTargets(user.plan)[0];
  const upgradeLabel = nextPlan ? `Upgrade to ${nextPlan.name} →` : 'View plan options →';

  const q = (searchParams.q ?? '').trim().toLowerCase();
  const minEr = canFilterAdvanced ? parseNumber(searchParams.min_er) : null;
  const maxRate = canFilterAdvanced ? parseNumber(searchParams.max_rate) : null;

  const creators = all.filter((creator) => {
    if (searchParams.platform && creator.platform !== searchParams.platform) return false;
    if (searchParams.category && creator.category !== searchParams.category) return false;
    if (minEr != null && (parseNumber(creator.er ?? undefined) ?? 0) < minEr) return false;
    if (maxRate != null && (creator.rate_min ?? 0) > maxRate) return false;
    if (!q) return true;
    return [creator.name, creator.handle, creator.niche, creator.platform]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(creators.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(searchParams.page ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleCreators = creators.slice(firstIndex, firstIndex + PAGE_SIZE);
  const firstShown = creators.length === 0 ? 0 : firstIndex + 1;
  const lastShown = Math.min(firstIndex + PAGE_SIZE, creators.length);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set('q', searchParams.q);
    if (searchParams.platform) params.set('platform', searchParams.platform);
    if (searchParams.category) params.set('category', searchParams.category);
    if (canFilterAdvanced && searchParams.min_er) params.set('min_er', searchParams.min_er);
    if (canFilterAdvanced && searchParams.max_rate) params.set('max_rate', searchParams.max_rate);
    params.set('page', String(page));
    return `/dashboard/creators?${params.toString()}`;
  };

  return (
    <div className="brand-marketplace-view">
      <div className="brand-marketplace-heading">
        <div>
          <h1>Creator Marketplace</h1>
          <p>
            {creators.length === all.length
              ? `${all.length} vetted creators`
              : `${creators.length} of ${all.length} vetted creators`}{' '}
            ({firstShown}–{lastShown} shown)
          </p>
        </div>

        <form className="brand-marketplace-search" method="get">
          <input name="q" placeholder="Search..." defaultValue={searchParams.q ?? ''} />
          {searchParams.platform && <input type="hidden" name="platform" value={searchParams.platform} />}
          {searchParams.category && <input type="hidden" name="category" value={searchParams.category} />}
          {canFilterAdvanced && (
            <>
              <input
                name="min_er"
                type="number"
                step="0.1"
                min="0"
                placeholder="Min ER %"
                defaultValue={searchParams.min_er ?? ''}
                aria-label="Minimum engagement rate"
              />
              <input
                name="max_rate"
                type="number"
                min="0"
                placeholder="Max rate $"
                defaultValue={searchParams.max_rate ?? ''}
                aria-label="Maximum rate"
              />
            </>
          )}
        </form>
      </div>

      {/* One quota line, always honest about what this plan actually grants. */}
      <div className="brand-dashboard-plan-note">
        {!quota.entitled ? (
          <>
            Creator contact details are hidden on the {planName(user.plan)} plan. They start on the{' '}
            {contactPlan} plan. <Link href="/dashboard/plan">{upgradeLabel}</Link>
          </>
        ) : quota.unlimited ? (
          <>Unlimited contact reveals on your plan — {revealedToday.size} unlocked today.</>
        ) : (
          <>
            {quota.used} of {revealLimitLabel(user.plan)} contact reveals used today.{' '}
            {quota.remaining === 0
              ? 'The quota resets at midnight UTC.'
              : `${quota.remaining} left.`}{' '}
            <Link href="/dashboard/plan">{upgradeLabel}</Link>
          </>
        )}
      </div>

      {!canFilterAdvanced && (
        <div className="brand-dashboard-plan-note">
          Engagement-rate and rate filters are part of the paid plans.{' '}
          <Link href="/dashboard/plan">{upgradeLabel}</Link>
        </div>
      )}

      <div className="brand-creator-grid">
        {visibleCreators.map((creator) => {
          const niche = creator.niche?.split('/')[0]?.trim() || 'General';
          const profileUrl = creator.channel_url || `/creators/${creator.id}`;
          // Unlimited plans and staff see every contact; metered plans see only
          // the creators they have actually spent a reveal on today.
          const unlocked = quota.unlimited || revealedToday.has(creator.id);

          return (
            <article className="brand-creator-card" key={creator.id}>
              <div className="brand-creator-photo" style={{ background: creator.accent_bg ?? '#F2F2F2' }}>
                {creator.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.photo_url} alt={creator.name} loading="lazy" />
                ) : (
                  <div className="brand-creator-fallback">{creator.emoji ?? '👤'}</div>
                )}
                <div className="brand-creator-photo-overlay" />
                <span className="brand-creator-platform">{creator.platform}</span>
                <span className="brand-creator-availability">Available</span>
              </div>

              <div className="brand-creator-body">
                <div className="brand-creator-name">{creator.name}</div>
                <div className="brand-creator-handle">{creator.handle}</div>
                <div className="brand-creator-niche">{niche}</div>

                <div className="brand-creator-stats">
                  <div>
                    <strong>{creator.audience ?? '—'}</strong>
                    <span>Followers</span>
                  </div>
                  <div>
                    <strong>{creator.er ?? '—'}</strong>
                    <span>ER</span>
                  </div>
                  <div>
                    <strong className="rate">{rateFrom(creator)}</strong>
                    <span>Rate</span>
                  </div>
                </div>

                {unlocked ? (
                  <div className="brand-creator-contact">
                    ✉ {creator.contact_email ?? creator.contact_hint ?? 'No contact on file'}
                  </div>
                ) : !quota.entitled ? (
                  <div className="brand-creator-contact locked">
                    <span>✉ Contact locked on {planName(user.plan)}</span>
                    <Link href="/dashboard/plan">{upgradeLabel}</Link>
                  </div>
                ) : quota.remaining === 0 ? (
                  <div className="brand-creator-contact locked">
                    <span>✉ Daily reveal quota used</span>
                    <Link href="/dashboard/plan">{upgradeLabel}</Link>
                  </div>
                ) : (
                  <RevealContactButton creatorId={creator.id} creatorName={creator.name} />
                )}

                <div className="brand-creator-actions">
                  <a
                    href={profileUrl}
                    className="brand-creator-profile"
                    target={creator.channel_url ? '_blank' : undefined}
                    rel={creator.channel_url ? 'noopener noreferrer' : undefined}
                  >
                    View Profile
                  </a>
                  <Link href={`/creators/${creator.id}`} className="brand-creator-portfolio">
                    Portfolio
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {creators.length === 0 && (
        <div className="brand-dashboard-empty-card">
          <div className="brand-dashboard-empty-icon">🔍</div>
          No creator matches those filters.
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
    </div>
  );
}
