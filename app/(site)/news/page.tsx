import Link from 'next/link';
import type { Metadata } from 'next';
import { listNewsForIndex, listPublishedShowcase, newsCategoryCounts } from '@/lib/services/content';
import { showcaseCardBg } from '@/lib/content';
import { NewsCard } from '@/components/news-card';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

export const metadata: Metadata = {
  title: 'News & Showcase',
  description: 'Case studies, brand campaigns and platform updates from BookingModel.',
  alternates: { canonical: '/news' },
};

const ALL = 'All';

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const [allPosts, counts, showcase] = await Promise.all([
    listNewsForIndex(),
    newsCategoryCounts(),
    BRAND_SHOWCASE_ENABLED ? listPublishedShowcase() : Promise.resolve([]),
  ]);

  const activeCategory = counts.some((c) => c.category === cat) ? cat! : ALL;
  const posts =
    activeCategory === ALL
      ? allPosts
      : allPosts.filter((post) => post.category === activeCategory);

  const chipHref = (category: string) =>
    category === ALL ? '/news' : `/news?cat=${encodeURIComponent(category)}`;

  return (
    <>
      <section className="sec">
        <div className="sec-eye">News &amp; Showcase</div>
        <h1 className="sec-h">Case studies &amp; <strong>updates</strong></h1>
        <p className="sec-p">
          How brands run creator campaigns on BookingModel, and what we are shipping next.
        </p>

        <nav className="news-filters" aria-label="Filter articles by category">
          <Link
            href={chipHref(ALL)}
            className={`news-chip${activeCategory === ALL ? ' on' : ''}`}
            aria-current={activeCategory === ALL ? 'page' : undefined}
          >
            All<span>{allPosts.length}</span>
          </Link>
          {counts.map(({ category, count }) => (
            <Link
              key={category}
              href={chipHref(category)}
              className={`news-chip${activeCategory === category ? ' on' : ''}`}
              aria-current={activeCategory === category ? 'page' : undefined}
            >
              {category}<span>{count}</span>
            </Link>
          ))}
        </nav>

        {!posts.length ? (
          <div className="news-empty">
            No articles published in this category yet.{' '}
            {activeCategory !== ALL && <Link href="/news">See everything →</Link>}
          </div>
        ) : (
          <div className="news-results">
            <div className="news-results-head">
              <span>{posts.length} {posts.length === 1 ? 'article' : 'articles'}</span>
              {activeCategory !== ALL && <span>Filtered by {activeCategory}</span>}
            </div>
            <div className="news-list">
              {posts.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        )}
      </section>

      {BRAND_SHOWCASE_ENABLED && (
        <>
          <div className="sec-divider" />

          <section className="sec">
            <div className="sec-eye">Brand Showcase</div>
            <h2 className="sec-h">Campaigns we <strong>delivered</strong></h2>
            <p className="sec-p">
              Real campaigns, real numbers. Open any card for the full breakdown.
            </p>

            {showcase.length === 0 ? (
              <div className="news-empty">No case studies published yet.</div>
            ) : (
              <div className="showcase-grid">
                {showcase.map((item) => (
                  <Link key={item.id} href={`/showcase/${item.slug}`} className="sc-card">
                    <div className="sc-media" style={{ background: showcaseCardBg(item) }}>
                      {item.cover_url ? (
                        <img className="news-cover" src={item.cover_url} alt={item.title} loading="lazy" />
                      ) : (
                        (item.emoji ?? '📰')
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
        </>
      )}
    </>
  );
}
