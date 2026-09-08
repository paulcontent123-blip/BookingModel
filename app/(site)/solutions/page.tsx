import Link from 'next/link';
import type { Metadata } from 'next';
import { SOLUTIONS } from '@/lib/solutions';

export const metadata: Metadata = {
  title: 'Solutions',
  description:
    'From your first UGC video to a full e-commerce operation — UGC, influencer marketing, e-commerce, advertising, production and brand identity.',
};

export default function SolutionsPage() {
  return (
    <section className="sec">
      <div className="sec-eye">Full-Service Creator Marketing</div>
      <h1 className="sec-h">
        Solutions for <strong>every growth stage</strong>
      </h1>
      <p className="sec-p">
        From your first UGC video to a full e-commerce operation. Select a solution to learn more.
      </p>

      <div className="sol-grid">
        {SOLUTIONS.map((s) => (
          <Link href={`/solutions/${s.slug}`} className="sol-item" key={s.slug}>
            <div className="sol-ico">{s.icon}</div>
            <div className="sol-title">{s.title}</div>
            <div className="sol-desc">{s.cardDesc}</div>
            <span className="sol-arrow">View details →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
