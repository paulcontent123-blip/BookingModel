import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { priceBooking } from '@/lib/payments';
import { lowestPlanWith, planName } from '@/lib/plans';
import { compactNumber, platformClass, rateLabel, unitPriceFor, money } from '@/lib/utils';
import { BookCreatorButton } from '@/components/book-creator-button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const creator = await db.get('creators', id);
  if (!creator) return { title: 'Creator not found' };
  return {
    title: `${creator.name} (${creator.handle})`,
    description: `${creator.niche} · ${creator.audience} followers on ${creator.platform}. Book from ${rateLabel(creator)} per video.`,
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = await db.get('creators', id);
  if (!creator || creator.status === 'rejected') notFound();

  const [portfolio, user] = await Promise.all([
    db.list('creator_portfolio', { where: { creator_id: id }, orderBy: 'sort_order' }),
    getSessionUser(),
  ]);

  const unit = unitPriceFor(creator);
  // Signed-out visitors see the Free rate, which is what the public site quotes.
  const price = priceBooking(unit, 1, user?.plan ?? 'free');

  return (
    <section className="sec">
      <Link href="/marketplace" className="sol-back">← Back to marketplace</Link>

      <div className="book-grid">
        <div>
          <div
            style={{
              height: 260,
              borderRadius: 8,
              border: '1px solid var(--border)',
              // 25% keeps the face in frame on a wide, short hero crop.
              background: creator.photo_url
                ? `#EEE url(${creator.photo_url}) center 25% / cover`
                : (creator.accent_bg ?? 'var(--bg2)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 64,
              marginBottom: 20,
              position: 'relative',
            }}
          >
            {!creator.photo_url && creator.emoji}
            <span className={`cg-b ${platformClass(creator.platform)}`} style={{ position: 'absolute', top: 12, left: 12 }}>
              {creator.platform}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
            {creator.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creator.avatar_url}
                alt=""
                style={{
                  width: 64,
                  height: 64,
                  flexShrink: 0,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--border)',
                  background: creator.accent_bg ?? 'var(--bg2)',
                }}
              />
            )}
            <div>
              <h1 className="sec-h" style={{ marginBottom: 4 }}>{creator.name}</h1>
              <p style={{ color: 'var(--blue)', fontWeight: 600 }}>{creator.handle}</p>
            </div>
          </div>

          <div className="row gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
            <span className="chip">{creator.niche}</span>
            <span className="chip chip-blue">{creator.category}</span>
            <span className="chip">{creator.tier} creator</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            {[
              ['Followers', creator.audience ?? compactNumber(creator.audience_count)],
              ['Engagement', creator.er ?? '—'],
              ['Rate / video', rateLabel(creator)],
              ['Platform', creator.platform],
            ].map(([label, value]) => (
              <div key={label} style={{ background: '#fff', padding: '16px 14px' }}>
                <div className="kpi-n" style={{ fontSize: 18 }}>{value}</div>
                <div className="kpi-l">{label}</div>
              </div>
            ))}
          </div>

          {creator.bio && (
            <>
              <div className="sec-eye">About</div>
              <p className="sec-p" style={{ maxWidth: '100%' }}>{creator.bio}</p>
            </>
          )}

          <div className="sec-eye" style={{ marginTop: 20 }}>Portfolio</div>
          {portfolio.length === 0 ? (
            <p className="muted small">No portfolio samples uploaded yet.</p>
          ) : (
            <div className="showcase-grid">
              {portfolio.map((p) => (
                <div className="sc-card" key={p.id}>
                  {p.type === 'video' && p.youtube_id ? (
                    <div style={{ position: 'relative', paddingBottom: '56%' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${p.youtube_id}`}
                        title={p.label ?? 'Portfolio video'}
                        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                      />
                    </div>
                  ) : (
                    <div
                      className="sc-media"
                      style={{ background: `#EEE url(${p.thumbnail ?? p.url}) center / cover` }}
                    />
                  )}
                  <div className="sc-body">
                    <div className="sc-title">{p.label ?? 'Content sample'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sec-eye" style={{ marginTop: 24 }}>Contact</div>
          <div className="alert alert-info">
            Full contact details are available inside the Brand dashboard from the{' '}
            {planName(lowestPlanWith('contact_reveals') ?? 'standard')} plan upwards.{' '}
            {user ? (
              <Link href="/dashboard/plan" style={{ fontWeight: 700 }}>View plan options →</Link>
            ) : (
              <Link href="/login" style={{ fontWeight: 700 }}>Sign in as Brand →</Link>
            )}
            <br />
            <span className="small">
              This public profile shows basic creator information only. You can still book through the
              platform without direct contact access.
            </span>
          </div>

          {creator.channel_url && (
            <a
              className="btn-hero-out"
              href={creator.channel_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 8 }}
            >
              View on {creator.platform} ↗
            </a>
          )}
        </div>

        <aside className="summary-card">
          <div className="sec-eye" style={{ marginBottom: 6 }}>Book this creator</div>
          <div style={{ fontFamily: 'var(--mont)', fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>
            {money(unit)}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}> / video</span>
          </div>
          <p className="summary-note" style={{ marginTop: 4, marginBottom: 14 }}>
            Published range {rateLabel(creator)}. Final price is confirmed at checkout.
          </p>

          <div className="summary-line"><span>1 video</span><strong>{money(price.subtotal)}</strong></div>
          <div className="summary-line">
            <span>Platform fee ({price.feePercent}%)</span><strong>{money(price.platformFee)}</strong>
          </div>
          <div className="summary-total"><span>Total</span><span>{money(price.total)}</span></div>

          <div style={{ marginTop: 16 }}>
            <BookCreatorButton
              creatorId={creator.id}
              creatorName={`${creator.name} (${creator.handle})`}
              available={creator.status === 'active'}
            />
          </div>

          <ul style={{ listStyle: 'none', marginTop: 16, fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>
            <li>✓ Creator notified by email immediately</li>
            <li>✓ Full commercial usage rights</li>
            <li>✓ Unlimited revisions until approval</li>
            <li>✓ Invoice issued on payment</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
