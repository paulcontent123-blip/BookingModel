import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listPublishedShowcase } from '@/lib/services/content';
import { showcaseCardBg } from '@/lib/content';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Brand Showcase',
  description:
    'Creator campaigns BookingModel delivered for DTC brands — the brief, the approach and the numbers.',
  alternates: { canonical: '/showcase' },
};

export default async function ShowcasePage() {
  if (!BRAND_SHOWCASE_ENABLED) notFound();

  const showcase = await listPublishedShowcase();

  return (
    <section className="sec">
      <div className="sec-eye">Brand Showcase</div>
      <h1 className="sec-h">Campaigns we <strong>delivered</strong></h1>
      <p className="sec-p">
        Every case study below is a campaign run on BookingModel, with the brief, the approach and
        the numbers it produced.
      </p>

      {showcase.length === 0 ? (
        <div className="news-empty">
          No case studies published yet. <Link href="/news">Read the latest news →</Link>
        </div>
      ) : (
        <div className="showcase-grid">
          {showcase.map((item) => (
            <Link key={item.id} href={`/showcase/${item.slug}`} className="sc-card">
              <div className="sc-media" style={{ background: showcaseCardBg(item) }}>
                {item.cover_url ? (
                  <img className="news-cover" src={item.cover_url} alt={item.title} loading="lazy" />
                ) : (
                  (item.emoji ?? '🎬')
                )}
                <span className="sc-tag">{item.tag}</span>
              </div>
              <div className="sc-body">
                <div className="sc-brand">{item.brand}</div>
                <div className="sc-title">{item.title}</div>
                <div className="sc-meta">{item.meta}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
