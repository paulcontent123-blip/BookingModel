import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { listCreatorsFromDatabase } from '@/lib/creator-data';
import { config } from '@/lib/config';
import { CreatorStripCard } from '@/components/creator-card';
import { FaqList } from '@/components/faq-list';
import { NewsCard } from '@/components/news-card';
import brandsData from '@/data/brands.json';
import { listNewsForIndex } from '@/lib/services/content';

export const metadata: Metadata = {
  title: {
    absolute: 'BookingModel - Influencer Marketing Platform for US Brands',
  },
  description:
    'BookingModel helps US brands discover and book creators for campaigns, UGC, and influencer collaborations through one easy-to-use platform.',
  openGraph: {
    title: 'BookingModel - Influencer Marketing Platform for US Brands',
    description:
      'BookingModel helps US brands discover and book creators for campaigns, UGC, and influencer collaborations through one easy-to-use platform.',
    type: 'website',
  },
};

const TICKER = [
  '140,000+ Vetted Creators',
  'UGC Videos from $59',
  'TikTok Shop Operation',
  'Influencer Marketing — End-to-End',
  'Meta & TikTok Advertising',
  'Amazon & Shopify Operation',
  'Creative Strategy & IMC Campaigns',
  'Money-Back Guarantee',
];

const SOLUTIONS = [
  { slug: 'ugc', icon: '🎬', title: 'On-Demand UGC & AI Creation', desc: 'Authentic video content from vetted creators. UGC, testimonials, unboxing, b-roll. AI-assisted pipeline for scale.' },
  { slug: 'influencer', icon: '🤝', title: 'Influencer Marketing', desc: 'End-to-end booking and campaign management. Creative strategist, IMC planning, invite and manage creators.' },
  { slug: 'ecommerce', icon: '🛒', title: 'E-Commerce Service', desc: 'Full operation for TikTok Shop, Amazon, Etsy and Shopify. Store setup, listings, ads, logistics coordination.' },
  { slug: 'advertising', icon: '📢', title: 'Advertising Spend', desc: 'Performance ad campaigns through TikTok Ads and Meta Ads. Creative, targeting, A/B testing, reporting.' },
  { slug: 'production', icon: '🎥', title: 'Production & Livestream', desc: 'Studio and on-location production for brand videos, livestream commerce, and event content.' },
  { slug: 'brand', icon: '🎯', title: 'Brand Identity & SEO', desc: 'Brand strategy, visual identity, content calendar, SEO and website optimization. Long-term growth.' },
];

const FAQ = [
  {
    q: 'What is BookingModel?',
    a: 'BookingModel is a creator marketing platform connecting North American brands with vetted UGC creators and influencers. We handle end-to-end campaign management from creator discovery and booking to content delivery, e-commerce operations and performance advertising.',
  },
  {
    q: 'How much does a UGC video cost?',
    a: 'UGC videos start at $59 per 30-second video for standard content. Pricing varies by creator tier, content type, usage rights and turnaround time. Contact us for a custom quote based on your campaign needs.',
  },
  {
    q: 'Which regions can book and pay online?',
    a: `Self-serve checkout is available to brands based in ${config.geo.allowedCountries.join(' and ')}. Everyone else can browse the full roster and see every rate — when you request a booking, our account manager contacts you within one business day and completes it with you directly.`,
  },
  {
    q: 'How do creators apply to campaigns?',
    a: 'Creators browse open campaigns on our platform and submit a brief application with their profile info and relevant past work. Our team reviews applications and notifies matched creators within 24 to 48 hours. There is no fee to apply as a creator.',
  },
  {
    q: 'What platforms do you cover?',
    a: 'We operate across TikTok, Instagram Reels, Meta Ads, YouTube Shorts, Pinterest and Amazon. For e-commerce, we manage TikTok Shop, Amazon Seller Central, Etsy and Shopify stores end-to-end.',
  },
  {
    q: 'Is there a minimum campaign budget?',
    a: 'For self-serve UGC campaigns, there is no minimum — you pay per video accepted. For managed influencer marketing campaigns, we recommend a minimum budget of $3,000. Contact us for enterprise and agency pricing.',
  },
];

const HOME_PAGE_SIZE = 3;

interface HomeSearchParams {
  campaignPage?: string;
  newsPage?: string;
}

function clampPage(value: string | undefined, totalItems: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / HOME_PAGE_SIZE));
  const requested = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), totalPages)
    : 1;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const sp = await searchParams;
  const [creators, allCampaigns, news] = await Promise.all([
    listCreatorsFromDatabase({ activeOnly: true, limit: 40 }),
    db.list('campaigns', { where: { status: 'active' }, orderBy: 'created_at' }),
    listNewsForIndex(),
  ]);

  const campaignTotalPages = Math.max(1, Math.ceil(allCampaigns.length / HOME_PAGE_SIZE));
  const newsTotalPages = Math.max(1, Math.ceil(news.length / HOME_PAGE_SIZE));
  const campaignPage = clampPage(sp.campaignPage, allCampaigns.length);
  const newsPage = clampPage(sp.newsPage, news.length);
  const campaigns = allCampaigns.slice(
    (campaignPage - 1) * HOME_PAGE_SIZE,
    campaignPage * HOME_PAGE_SIZE,
  );
  const visibleNews = news.slice((newsPage - 1) * HOME_PAGE_SIZE, newsPage * HOME_PAGE_SIZE);

  const pageHref = (section: 'campaign' | 'news', page: number) => {
    const params = new URLSearchParams();
    if (section === 'campaign' && page > 1) params.set('campaignPage', String(page));
    if (section === 'news' && page > 1) params.set('newsPage', String(page));
    if (section === 'campaign' && newsPage > 1) params.set('newsPage', String(newsPage));
    if (section === 'news' && campaignPage > 1) params.set('campaignPage', String(campaignPage));
    const query = params.toString();
    return `/${query ? `?${query}` : ''}#${section === 'campaign' ? 'open-campaigns' : 'news-showcase'}`;
  };

  const strip1 = creators.slice(0, 12);
  const strip2 = creators.slice(12, 24);
  const brands = brandsData as string[];

  return (
    <>
      <div className="ticker">
        <div className="ticker-wrap">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span className="t-item" key={i}>
              <span className="dot">●</span> {t}
            </span>
          ))}
        </div>
      </div>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <div>
              <div className="hero-tag">Live · North America</div>
              <h1 className="hero-h">
                The Creator Platform for Brands That{' '}
                <strong>Actually Convert.</strong>
              </h1>
              <p className="hero-sub">
                UGC videos, influencer campaigns, e-commerce operations and brand production — all
                from one platform. Built for US DTC brands ready to scale.
              </p>
              <div className="hero-actions">
                <Link href="/contact" className="btn-hero">Request a Campaign</Link>
                <Link href="/marketplace" className="btn-hero-out">Browse Creators</Link>
              </div>
              <div className="hero-kpis">
                <div><div className="kpi-n">140K+</div><div className="kpi-l">Vetted creators</div></div>
                <div><div className="kpi-n">$59</div><div className="kpi-l">Avg cost per video</div></div>
                <div><div className="kpi-n">7 days</div><div className="kpi-l">Avg delivery</div></div>
                <div><div className="kpi-n">20%</div><div className="kpi-l">Lower CPA avg</div></div>
              </div>
            </div>

            <div>
              <div className="hs-label">See BookingModel in action</div>
              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  background: 'var(--bg2)',
                  height: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 46, letterSpacing: 6 }}>👩 🏃 💄</div>
                <div style={{ fontFamily: 'var(--mont)', fontWeight: 700, fontSize: 14 }}>
                  140,000+ creators ready to work
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  UGC creators that convert · 2 min
                </div>
              </div>
            </div>
          </div>

          <div className="hero-scroll-area">
            <div className="hs-label">Live on platform — food &amp; lifestyle creators</div>
            <div className="creator-strip">
              <div className="cs-track">
                {[...strip1, ...strip1].map((c, i) => (
                  <CreatorStripCard key={`${c.id}-${i}`} creator={c} />
                ))}
              </div>
            </div>
            <div className="creator-strip" style={{ marginTop: 10 }}>
              <div className="cs-track rev">
                {[...strip2, ...strip2].map((c, i) => (
                  <CreatorStripCard key={`${c.id}-${i}`} creator={c} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="brand-strip">
        <div className="bs-track">
          {[...brands, ...brands].map((b, i) => (
            <div className="bs-item" key={i}><span className="bs-logo">{b}</span></div>
          ))}
        </div>
      </div>

      <section className="sec">
        <div className="sec-eye">Our Solutions</div>
        <h2 className="sec-h">
          Everything your brand needs to <strong>win on social commerce</strong>
        </h2>
        <div className="sol-grid">
          {SOLUTIONS.map((s) => (
            <Link href={`/solutions/${s.slug}`} className="sol-item" key={s.slug}>
              <div className="sol-ico">{s.icon}</div>
              <div className="sol-title">{s.title}</div>
              <div className="sol-desc">{s.desc}</div>
              <span className="sol-arrow">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="sec-divider" />

      <section className="sec home-section-anchor" id="open-campaigns">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="sec-eye">Open Campaigns</div>
            <h2 className="sec-h">Creators — <strong>Apply Now</strong></h2>
            <p className="sec-p">Active brand campaigns looking for creators to apply.</p>
          </div>
          <Link href="/campaigns" className="btn-ghost">View all →</Link>
        </div>

        <div className="camp-grid">
          {campaigns.map((c) => (
            <Link href="/campaigns" className="camp-card" key={c.id}>
              <div className="camp-img" style={{ background: c.accent_bg ?? 'var(--bg2)' }}>
                {c.cover_url && <img className="camp-cover" src={c.cover_url} alt={c.title} />}
                <span className="camp-badge cb-open">Open</span>
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
                <div className="camp-apply">
                  <span className="camp-spots">
                    {Math.max(0, c.spots_total - c.spots_filled)} spots left
                  </span>
                  <span className="btn-apply">Apply</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {campaignTotalPages > 1 && (
          <nav className="pagination" aria-label="Open campaign pages">
            <Link
              href={pageHref('campaign', campaignPage - 1)}
              className={campaignPage === 1 ? 'disabled' : undefined}
              aria-label="Previous campaign page"
              aria-disabled={campaignPage === 1}
            >
              ←
            </Link>
            {Array.from({ length: campaignTotalPages }, (_, index) => index + 1).map((page) => (
              <Link
                key={page}
                href={pageHref('campaign', page)}
                className={page === campaignPage ? 'on' : undefined}
                aria-current={page === campaignPage ? 'page' : undefined}
              >
                {page}
              </Link>
            ))}
            <Link
              href={pageHref('campaign', campaignPage + 1)}
              className={campaignPage === campaignTotalPages ? 'disabled' : undefined}
              aria-label="Next campaign page"
              aria-disabled={campaignPage === campaignTotalPages}
            >
              →
            </Link>
          </nav>
        )}
      </section>

      <div className="sec-divider" />

      <section className="sec home-section-anchor" id="news-showcase">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="sec-eye">News &amp; Showcase</div>
            <h2 className="sec-h">Case studies &amp; <strong>platform updates</strong></h2>
          </div>
          <Link href="/news" className="btn-ghost">All news &amp; case studies →</Link>
        </div>

        <div className="news-list news-home-list">
          {visibleNews.map((post) => (
            <NewsCard key={post.id} post={post} />
          ))}
        </div>

        {newsTotalPages > 1 && (
          <nav className="pagination" aria-label="News and showcase pages">
            <Link
              href={pageHref('news', newsPage - 1)}
              className={newsPage === 1 ? 'disabled' : undefined}
              aria-label="Previous news page"
              aria-disabled={newsPage === 1}
            >
              ←
            </Link>
            {Array.from({ length: newsTotalPages }, (_, index) => index + 1).map((page) => (
              <Link
                key={page}
                href={pageHref('news', page)}
                className={page === newsPage ? 'on' : undefined}
                aria-current={page === newsPage ? 'page' : undefined}
              >
                {page}
              </Link>
            ))}
            <Link
              href={pageHref('news', newsPage + 1)}
              className={newsPage === newsTotalPages ? 'disabled' : undefined}
              aria-label="Next news page"
              aria-disabled={newsPage === newsTotalPages}
            >
              →
            </Link>
          </nav>
        )}
      </section>

      <div className="sec-divider" />

      <section className="sec">
        <div className="sec-eye">FAQ</div>
        <h2 className="sec-h">Common <strong>questions</strong></h2>
        <FaqList items={FAQ} />
        <p className="sec-p" style={{ marginTop: 24 }}>
          Have more questions? We respond within one business day.{' '}
          <Link href="/contact" style={{ color: 'var(--blue)', fontWeight: 700 }}>Contact us</Link>
        </p>
      </section>
    </>
  );
}
