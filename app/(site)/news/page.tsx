import type { Metadata } from 'next';
import newsData from '@/data/news.json';
import showcaseData from '@/data/showcase.json';

export const metadata: Metadata = {
  title: 'News & Showcase',
  description: 'Case studies, brand campaigns and platform updates from BookingModel.',
};

interface NewsItem {
  ico: string;
  bg: string;
  cat: string;
  title: string;
  date: string;
  summary: string;
}

interface ShowcaseItem {
  ico: string;
  bg: string;
  brand: string;
  title: string;
  meta: string;
  tag: string;
}

export default function NewsPage() {
  const news = newsData as NewsItem[];
  const showcase = showcaseData as ShowcaseItem[];

  return (
    <>
      <section className="sec">
        <div className="sec-eye">News &amp; Showcase</div>
        <h1 className="sec-h">Case studies &amp; <strong>updates</strong></h1>
        <p className="sec-p">
          How brands run creator campaigns on BookingModel, and what we are shipping next.
        </p>

        <div className="news-grid">
          <article className="news-main">
            <div className="nm-img" style={{ background: news[0]!.bg }}>{news[0]!.ico}</div>
            <div className="nm-body">
              <div className="nm-cat">{news[0]!.cat}</div>
              <h2 className="nm-title">{news[0]!.title}</h2>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.75, marginBottom: 10 }}>
                {news[0]!.summary}
              </p>
              <div className="nm-date">{news[0]!.date}</div>
            </div>
          </article>

          <div className="news-side">
            {news.slice(1).map((n, i) => (
              <article className="ns-card" key={i}>
                <div className="ns-img" style={{ background: n.bg }}>{n.ico}</div>
                <div className="ns-body">
                  <div className="ns-cat">{n.cat}</div>
                  <div className="ns-title">{n.title}</div>
                  <div className="ns-date">{n.date}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      <section className="sec">
        <div className="sec-eye">Brand Showcase</div>
        <h2 className="sec-h">Campaigns we <strong>delivered</strong></h2>

        <div className="showcase-grid">
          {showcase.map((s, i) => (
            <article className="sc-card" key={i}>
              <div className="sc-media" style={{ background: s.bg }}>
                {s.ico}
                <span className="sc-tag">{s.tag}</span>
              </div>
              <div className="sc-body">
                <div className="sc-brand">{s.brand}</div>
                <div className="sc-title">{s.title}</div>
                <div className="sc-meta">{s.meta}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
