import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { feePercentLabel, formatDate, money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Booking confirmed' };

export default async function BookingSuccessPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const deal = await db.findOne('deals', { deal_ref: decodeURIComponent(ref) });
  if (!deal) notFound();

  const [creator, invoice] = await Promise.all([
    db.get('creators', deal.creator_id),
    db.findOne('invoices', { deal_id: deal.id }),
  ]);

  return (
    <section className="sec" style={{ maxWidth: 720 }}>
      <div className="success-hero">
        <div className="success-mark">✓</div>
        <h1 className="sec-h" style={{ marginBottom: 6 }}>Payment successful</h1>
        <p className="sec-p" style={{ margin: '0 auto' }}>
          Booking <strong>{deal.deal_ref}</strong> is confirmed.
          {creator && <> We have emailed the brief to <strong>{creator.name}</strong>.</>}
        </p>
      </div>

      <div className="form-box mb-16">
        <div className="form-title">Booking summary</div>
        {[
          ['Reference', deal.deal_ref],
          ['Creator', creator ? `${creator.name} (${creator.handle})` : '—'],
          ['Deliverables', deal.deliverables ?? `${deal.quantity}× ${deal.content_type}`],
          ['Requested delivery', formatDate(deal.due_date)],
          ['Subtotal', money(deal.subtotal_usd)],
          [`Platform fee (${feePercentLabel(deal.platform_fee_percent)}%)`, money(deal.platform_fee_usd)],
          ['Total paid', money(deal.total_usd)],
          ['Payment method', `${deal.payment_provider} · ${deal.payment_ref}`],
          ['Status', deal.status.replace(/_/g, ' ')],
        ].map(([label, value]) => (
          <div className="summary-line" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="alert alert-ok">
        <strong>What happens next</strong>
        <br />
        1. {creator?.name ?? 'The creator'} confirms within 48 hours.<br />
        2. Content is produced and submitted for your review.<br />
        3. You approve or request revisions — unlimited until you are satisfied.<br />
        4. Final files are delivered with full commercial usage rights.
        {deal.creator_notified_at ? (
          <><br /><span className="small">Creator notified at {formatDate(deal.creator_notified_at)}.</span></>
        ) : (
          <><br /><span className="small">
            Creator notification is queued — our team confirms it manually if delivery fails.
          </span></>
        )}
      </div>

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        {invoice && (
          <Link href={`/invoices/${invoice.invoice_no}`} className="btn-hero">
            View invoice {invoice.invoice_no} →
          </Link>
        )}
        <Link href="/dashboard/bookings" className="btn-hero-out">My bookings</Link>
        <Link href="/marketplace" className="btn-hero-out">Book another creator</Link>
      </div>
    </section>
  );
}
