import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { formatDate, formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton } from '@/components/admin/action-button';
import {
  processCreatorBookingTimeoutsAction,
  resendCreatorNotificationAction,
  retryBookingRefundAction,
} from '@/lib/services/admin-actions';
import type { DealStatus } from '@/lib/types';

export const metadata = { title: 'Booking Deal Details' };

function readable(value: string | null | undefined): string {
  return value ? value.replace(/_/g, ' ') : '—';
}

function timelineState(
  step: 'payment' | 'response' | 'production' | 'completion',
  dealStatus: DealStatus,
  paymentStatus: string,
  responseStatus: string,
): 'done' | 'current' | 'waiting' | 'failed' {
  if (step === 'payment') {
    if (paymentStatus === 'refunded' || paymentStatus === 'failed') return 'failed';
    return paymentStatus === 'paid' ? 'done' : 'current';
  }
  if (step === 'response') {
    if (responseStatus === 'declined' || responseStatus === 'expired') return 'failed';
    if (responseStatus === 'accepted') return 'done';
    return 'current';
  }
  if (dealStatus === 'cancelled' || dealStatus === 'overdue') return 'failed';
  if (step === 'production') {
    if (['content_in_review', 'approved', 'published', 'completed'].includes(dealStatus)) return 'done';
    if (dealStatus === 'brief_sent' || dealStatus === 'negotiating') return 'current';
    return 'waiting';
  }
  if (dealStatus === 'completed') return 'done';
  return 'waiting';
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await db.get('deals', id);
  if (!deal) notFound();

  const [creator, invoice] = await Promise.all([
    db.get('creators', deal.creator_id),
    db.findOne('invoices', { deal_id: deal.id }),
  ]);

  const response = deal.creator_response_status ?? 'accepted';
  const timeline = [
    {
      key: 'payment' as const,
      title: 'Payment',
      detail: `${readable(deal.payment_status)} · ${deal.payment_provider ?? 'provider not recorded'}`,
    },
    {
      key: 'response' as const,
      title: 'Creator response',
      detail: response === 'pending' && deal.creator_response_expires_at
        ? `Waiting until ${formatDate(deal.creator_response_expires_at)}`
        : readable(response),
    },
    {
      key: 'production' as const,
      title: 'Production',
      detail: readable(deal.status),
    },
    {
      key: 'completion' as const,
      title: 'Completion',
      detail: deal.status === 'completed' ? 'Completed' : 'Not completed',
    },
  ];

  return (
    <>
      <Link href="/admin/deals" className="btn btn-ghost btn-sm deal-back-link">
        ← All booking deals
      </Link>

      <div className="deal-detail-header">
        <div>
          <h1 className="pg-title">{deal.deal_ref}</h1>
          <p className="pg-sub">
            {deal.brand_name ?? 'Unknown brand'} → {creator?.name ?? 'Unknown creator'} · created {formatDateTime(deal.created_at)}
          </p>
        </div>
        {invoice && (
          <Link href={`/invoices/${invoice.invoice_no}`} className="btn btn-ghost">
            View invoice
          </Link>
        )}
      </div>

      <div className="deal-status-grid">
        <div className="deal-status-card"><span>Lifecycle</span><StatusBadge status={deal.status} /></div>
        <div className="deal-status-card"><span>Payment</span><StatusBadge status={deal.payment_status} /></div>
        <div className="deal-status-card"><span>Creator response</span><StatusBadge status={response} /></div>
        <div className="deal-status-card"><span>Refund</span><StatusBadge status={deal.refund_status ?? 'not_required'} /></div>
      </div>

      <div className="deal-detail-layout">
        <section className="card">
          <div className="card-title">Booking progress</div>
          <div className="deal-timeline">
            {timeline.map((item) => {
              const state = timelineState(item.key, deal.status, deal.payment_status, response);
              return (
                <div className={`deal-timeline-item ${state}`} key={item.key}>
                  <div className="deal-timeline-dot">{state === 'done' ? '✓' : state === 'failed' ? '!' : '·'}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="deal-detail-muted">{item.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="card deal-actions-card">
          <div className="card-title">Booking status</div>
          <div className="deal-readonly-status">
            <span>Lifecycle status</span>
            <StatusBadge status={deal.status} />
            <p>Status is updated by the booking workflow, creator response and payment events.</p>
          </div>
          <div className="btn-row">
            {response === 'pending' && (
              <ActionButton
                label="Re-send creator invite"
                pendingLabel="Sending…"
                action={async () => {
                  'use server';
                  return resendCreatorNotificationAction(id);
                }}
              />
            )}
            {deal.refund_status === 'failed' && (
              <ActionButton
                label="Retry refund"
                pendingLabel="Refunding…"
                className="btn btn-danger btn-sm"
                confirm="Retry the refund with the payment provider?"
                action={async () => {
                  'use server';
                  return retryBookingRefundAction(id);
                }}
              />
            )}
            {response === 'pending' && (
              <ActionButton
                label="Run timeout check"
                pendingLabel="Checking…"
                className="btn btn-ghost btn-sm"
                action={async () => {
                  'use server';
                  return processCreatorBookingTimeoutsAction();
                }}
              />
            )}
          </div>
        </aside>
      </div>

      <div className="deal-detail-info-grid">
        <section className="card">
          <div className="card-title">Brand</div>
          <dl className="deal-detail-list">
            <dt>Name</dt><dd>{deal.brand_name ?? '—'}</dd>
            <dt>Email</dt><dd className="deal-detail-break">{deal.brand_email ?? '—'}</dd>
            <dt>Brand ID</dt><dd className="mono deal-detail-break">{deal.brand_id ?? 'Guest checkout'}</dd>
            <dt>Origin</dt><dd>{deal.origin_country ?? '—'}</dd>
          </dl>
        </section>

        <section className="card">
          <div className="card-title">Creator</div>
          <dl className="deal-detail-list">
            <dt>Profile</dt>
            <dd>
              {creator ? <Link href={`/admin/creators/${creator.id}`} className="deal-list-link">{creator.name}</Link> : '—'}
            </dd>
            <dt>Handle</dt><dd>{creator?.handle ?? '—'}</dd>
            <dt>Contact email</dt><dd className="deal-detail-break">{creator?.contact_email ?? '—'}</dd>
            <dt>Notified</dt><dd>{deal.creator_notified_at ? formatDateTime(deal.creator_notified_at) : 'Not recorded'}</dd>
          </dl>
        </section>

        <section className="card">
          <div className="card-title">Booking brief</div>
          <dl className="deal-detail-list">
            <dt>Content type</dt><dd>{deal.content_type ?? '—'}</dd>
            <dt>Deliverables</dt><dd>{deal.deliverables ?? '—'}</dd>
            <dt>Quantity</dt><dd>{deal.quantity}</dd>
            <dt>Due date</dt><dd>{formatDate(deal.due_date)}</dd>
          </dl>
          <div className="deal-detail-copy">
            <strong>Brief</strong>
            <p>{deal.brief ?? 'No brief provided.'}</p>
          </div>
          {deal.notes && (
            <div className="deal-detail-copy">
              <strong>Notes</strong>
              <p>{deal.notes}</p>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title">Financial details</div>
          <dl className="deal-detail-list">
            <dt>Subtotal</dt><dd>{money(deal.subtotal_usd)}</dd>
            <dt>Platform fee</dt><dd>{money(deal.platform_fee_usd)} ({deal.platform_fee_percent}%)</dd>
            <dt>Tax</dt><dd>{money(deal.tax_usd)}</dd>
            <dt>Total</dt><dd><strong>{money(deal.total_usd)}</strong></dd>
            <dt>Payment ref</dt><dd className="mono deal-detail-break">{deal.payment_ref ?? '—'}</dd>
            <dt>Invoice</dt><dd>{invoice ? invoice.invoice_no : '—'}</dd>
            <dt>Payout</dt><dd><StatusBadge status={deal.payout_status ?? 'not_due'} /></dd>
            <dt>Payout ref</dt><dd className="mono deal-detail-break">{deal.payout_ref ?? '—'}</dd>
          </dl>
        </section>
      </div>

      <div className="deal-detail-footer-meta">
        <span>Last updated: {formatDateTime(deal.updated_at)}</span>
        {deal.refund_reason && <span>Refund reason: {readable(deal.refund_reason)}</span>}
        {deal.refunded_at && <span>Refunded: {formatDateTime(deal.refunded_at)}</span>}
      </div>
    </>
  );
}
