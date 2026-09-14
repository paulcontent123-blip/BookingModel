import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { findShowcaseBySlug, relatedShowcase } from '@/lib/services/content';
import { autoExcerpt, isoDate, showcaseCardBg } from '@/lib/content';
import { ContentBody } from '@/components/content-body';
import { config } from '@/lib/config';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!BRAND_SHOWCASE_ENABLED) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const { slug } = await params;
  const item = await findShowcaseBySlug(slug);
  if (!item) return { title: 'Case study not found', robots: { index: false, follow: false } };

  const title = `${item.brand} — ${item.title}`;
  const description = item.summary ?? autoExcerpt(item.outcome);

  return {
    title,
    description,
    alternates: { canonical: `/showcase/${item.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      images: item.cover_url ? [item.cover_url] : undefined,
    },
  };
}

export default async function ShowcaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!BRAND_SHOWCASE_ENABLED) notFound();

  const { slug } = await params;
  const item = await findShowcaseBySlug(slug);
  if (!item) notFound();

  const related = await relatedShowcase(item);
  const description = item.summary ?? autoExcerpt(item.outcome);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${item.brand} — ${item.title}`,
    description,
    datePublished: isoDate(item.published_at ?? item.created_at),
    dateModified: isoDate(item.updated_at) ?? isoDate(item.created_at),
    author: { '@type': 'Organization', name: 'BookingModel' },
    publisher: { '@type': 'Organization', name: 'BookingModel' },
    articleSection: item.tag,
    about: item.brand,
    mainEntityOfPage: `${config.site.url}/showcase/${item.slug}`,
    ...(item.cover_url ? { image: [item.cover_url] } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="sec">
        <div className="art-wrap">
          <nav className="art-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span>/</span> <Link href="/showcase">Brand Showcase</Link>{' '}
            <span>/</span> {item.brand}
          </nav>

          <Link href="/news" className="sol-back">← Back to News &amp; Showcase</Link>

          <div className="sec-eye">{item.brand} · {item.tag}</div>
          <h1 className="sec-h">{item.title}</h1>

          <div className="art-meta">
            {item.platform && <b>{item.platform}</b>}
            {item.platform && item.meta && <span>·</span>}
            {item.meta && <span>{item.meta}</span>}
          </div>

          <div className="art-hero" style={{ background: showcaseCardBg(item) }}>
            {item.cover_url ? (
              <img className="news-cover" src={item.cover_url} alt={item.title} />
            ) : (
              (item.emoji ?? '🎬')
            )}
          </div>

          {item.summary && <p className="art-lead">{item.summary}</p>}

          {item.metrics.length > 0 && (
            <div className="cs-metrics">
              {item.metrics.map((metric) => (
                <div className="cs-metric" key={metric.label}>
                  <div className="cs-metric-v">{metric.value || '—'}</div>
                  <div className="cs-metric-l">{metric.label}</div>
                </div>
              ))}
            </div>
          )}

          {item.challenge && (
            <>
              <h2 className="sec-h" style={{ fontSize: 22, marginTop: 34 }}>The challenge</h2>
              <ContentBody body={item.challenge} />
            </>
          )}

          {item.approach && (
            <>
              <h2 className="sec-h" style={{ fontSize: 22, marginTop: 24 }}>What we ran</h2>
              <ContentBody body={item.approach} />
            </>
          )}

          {item.outcome && (
            <>
              <h2 className="sec-h" style={{ fontSize: 22, marginTop: 24 }}>The result</h2>
              <ContentBody body={item.outcome} />
            </>
          )}

          <div className="art-cta">
            <h2 className="sec-h" style={{ fontSize: 24, marginBottom: 8 }}>
              Run something like this
            </h2>
            <p className="sec-p" style={{ marginBottom: 16 }}>
              Tell us your product, budget and timeline. We come back with a creator shortlist
              within one business day.
            </p>
            <Link
              href={`/contact?type=${encodeURIComponent(`${item.brand} style campaign`)}`}
              className="btn-hero"
            >
              Request a campaign →
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <>
          <div className="sec-divider" />
          <section className="sec">
            <div className="sec-eye">More case studies</div>
            <h2 className="sec-h">Other campaigns we <strong>delivered</strong></h2>

            <div className="showcase-grid">
              {related.map((other) => (
                <Link key={other.id} href={`/showcase/${other.slug}`} className="sc-card">
                  <div className="sc-media" style={{ background: showcaseCardBg(other) }}>
                    {other.cover_url ? (
                      <img
                        className="news-cover"
                        src={other.cover_url}
                        alt={other.title}
                        loading="lazy"
                      />
                    ) : (
                      (other.emoji ?? '🎬')
                    )}
                    <span className="sc-tag">{other.tag}</span>
                  </div>
                  <div className="sc-body">
                    <div className="sc-brand">{other.brand}</div>
                    <div className="sc-title">{other.title}</div>
                    <div className="sc-meta">{other.meta}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
