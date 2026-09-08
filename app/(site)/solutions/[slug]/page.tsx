import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SOLUTIONS, findSolution } from '@/lib/solutions';

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = findSolution(slug);
  if (!solution) return { title: 'Solution not found' };
  return { title: solution.title, description: solution.intro.slice(0, 155) };
}

export default async function SolutionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const solution = findSolution(slug);
  if (!solution) notFound();

  return (
    <section className="sec">
      <Link href="/solutions" className="sol-back">← Back to Solutions</Link>

      <div className="sol-ico" style={{ fontSize: 34 }}>{solution.icon}</div>
      <h1 className="sec-h">{solution.headline}</h1>
      <div className="sec-eye" style={{ marginBottom: 14 }}>{solution.tagline}</div>
      <p className="sec-p" style={{ maxWidth: 760 }}>{solution.intro}</p>

      <div className="sec-eye" style={{ marginTop: 34 }}>How it works</div>
      <div className="partner-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {solution.steps.map((step, i) => (
          <div className="pcard" key={step.title}>
            <div
              className="pcard-ico"
              style={{
                fontFamily: 'var(--mont)',
                fontWeight: 900,
                fontSize: 22,
                color: 'var(--blue)',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="pcard-title">{step.title}</div>
            <div className="pcard-desc">{step.body}</div>
          </div>
        ))}
      </div>

      <div className="sec-eye" style={{ marginTop: 40 }}>What is included</div>
      <div className="partner-grid">
        {solution.includes.map((item) => (
          <div className="pcard" key={item.title}>
            <div className="pcard-ico">{item.icon}</div>
            <div className="pcard-title">{item.title}</div>
            <div className="pcard-desc">{item.body}</div>
          </div>
        ))}
      </div>

      <div
        className="form-box"
        style={{ marginTop: 40, maxWidth: 620, textAlign: 'center' }}
      >
        <h2 className="sec-h" style={{ fontSize: 26, marginBottom: 8 }}>Ready to get started?</h2>
        <p className="sec-p" style={{ margin: '0 auto 18px' }}>
          Tell us about your brand and goals. We respond within one business day.
        </p>
        <Link href={`/contact?type=${encodeURIComponent(solution.title)}`} className="btn-hero">
          {solution.cta} →
        </Link>
      </div>
    </section>
  );
}
