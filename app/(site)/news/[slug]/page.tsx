import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { findNewsBySlug, relatedNews } from '@/lib/services/content';
import {
  autoExcerpt,
  formatPublishDate,
  isoDate,
  newsCardBg,
  readingMinutes,
} from '@/lib/content';
import { ContentBody } from '@/components/content-body';
import { config } from '@/lib/config';

// The site layout reads cookies and geo headers, so every public page renders
// per request — the article is fetched from the CMS the same way.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await findNewsBySlug(slug);
  if (!post) return { title: 'Article not found', robots: { index: false, follow: false } };

  const description = post.seo_description ?? post.excerpt ?? autoExcerpt(post.body);
  const title = post.seo_title ?? post.title;

  return {
    title,
    description,
    alternates: { canonical: `/news/${post.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      publishedTime: isoDate(post.published_at ?? post.created_at),
      images: post.cover_url ? [post.cover_url] : undefined,
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await findNewsBySlug(slug);
  if (!post) notFound();

  const related = await relatedNews(post);
  const published = post.published_at ?? post.created_at;
  const description = post.seo_description ?? post.excerpt ?? autoExcerpt(post.body);

  // Article structured data, so the case studies can surface as rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    datePublished: isoDate(published),
    dateModified: isoDate(post.updated_at) ?? isoDate(published),
    author: { '@type': 'Organization', name: post.author ?? 'BookingModel' },
    publisher: { '@type': 'Organization', name: 'BookingModel' },
    articleSection: post.category,
    mainEntityOfPage: `${config.site.url}/news/${post.slug}`,
    ...(post.cover_url ? { image: [post.cover_url] } : {}),
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
            <Link href="/">Home</Link> <span>/</span> <Link href="/news">News &amp; Showcase</Link>{' '}
            <span>/</span> {post.category}
          </nav>

          <Link href="/news" className="sol-back">← Back to News &amp; Showcase</Link>

          <div className="sec-eye">{post.category}</div>
          <h1 className="sec-h">{post.title}</h1>

          <div className="art-meta">
            <b>{post.author ?? 'BookingModel'}</b>
            <span>·</span>
            <time dateTime={isoDate(published)}>{formatPublishDate(published)}</time>
            <span>·</span>
            <span>{readingMinutes(post.body)} min read</span>
          </div>

          <div className="art-hero" style={{ background: newsCardBg(post) }}>
            {post.cover_url ? (
              <img className="news-cover" src={post.cover_url} alt={post.title} />
            ) : (
              (post.emoji ?? '📰')
            )}
          </div>

          {post.excerpt && <p className="art-lead">{post.excerpt}</p>}

          <ContentBody body={post.body} showToc={post.show_toc !== false} />

          <div className="art-cta">
            <h2 className="sec-h" style={{ fontSize: 24, marginBottom: 8 }}>
              Want results like these?
            </h2>
            <p className="sec-p" style={{ marginBottom: 16 }}>
              Tell us about your brand and goals. We respond within one business day.
            </p>
            <Link href="/contact?type=Campaign%20Request" className="btn-hero">
              Request a campaign →
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <>
          <div className="sec-divider" />
          <section className="sec">
            <div className="sec-eye">Keep reading</div>
            <h2 className="sec-h">More from <strong>BookingModel</strong></h2>

            <div className="news-list">
              {related.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`} className="nl-card">
                  <div className="nl-img" style={{ background: newsCardBg(item) }}>
                    {item.cover_url ? (
                      <img className="news-cover" src={item.cover_url} alt={item.title} loading="lazy" />
                    ) : (
                      (item.emoji ?? '📰')
                    )}
                  </div>
                  <div className="nl-body">
                    <div className="ns-cat">{item.category}</div>
                    <div className="ns-title">{item.title}</div>
                    <div className="ns-date">
                      {formatPublishDate(item.published_at ?? item.created_at)}
                    </div>
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
