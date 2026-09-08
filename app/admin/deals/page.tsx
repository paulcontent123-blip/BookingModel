import Link from 'next/link';
import { db } from '@/lib/db';
import { feePercentLabel, formatDate, formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import type { DealStatus } from '@/lib/types';

export const metadata = { title: 'Booking Deals' };

const STATUSES: DealStatus[] = [
  'pending_payment', 'negotiating', 'brief_sent', 'content_in_review',
  'approved', 'published', 'completed', 'overdue', 'cancelled',
];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await db.list('deals', { orderBy: 'created_at', ascending: false });
  const deals = status ? all.filter((d) => d.status === status) : all;

  const creators = await db.list('creators', { limit: 1000 });
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  const paid = all.filter((d) => d.payment_status === 'paid');
  const gross = paid.reduce((s, d) => s + d.total_usd, 0);
  const fees = paid.reduce((s, d) => s + d.platform_fee_usd, 0);
  const feeBase = paid.reduce((s, d) => s + d.subtotal_usd, 0);
  const blendedFee = feeBase ? (fees * 100) / feeBase : 0;
  const awaitingCreator = all.filter((d) => (d.creator_response_status ?? 'accepted') === 'pending').length;
  const refundReview = all.filter((d) => d.refund_status === 'failed').length;

  return (
    <>
      <h1 className="pg-title">Booking Deals</h1>
      <p className="pg-sub">
        Select a booking to review the full brief, payment, creator response and admin actions.
      </p>

      <div className="stat-grid">
        <div className="stat-card"><div className="sc-n">{money(gross)}</div><div className="sc-l">Paid booking value</div></div>
        <div className="stat-card"><div className="sc-n">{paid.length}</div><div className="sc-l">Paid deals</div><div className="sc-d">{money(fees)} fees · {feePercentLabel(blendedFee)}% blended</div></div>
        <div className="stat-card"><div className="sc-n">{awaitingCreator}</div><div className="sc-l">Awaiting creator response</div></div>
        <div className="stat-card"><div className="sc-n">{refundReview}</div><div className="sc-l">Refunds needing review</div></div>
      </div>

      <div className="pill-bar">
        <Link href="/admin/deals" className={`pill${!status ? ' on' : ''}`}>All ({all.length})</Link>
        {STATUSES.map((s) => {
          const n = all.filter((d) => d.status === s).length;
          if (!n) return null;
          return (
            <Link key={s} href={`/admin/deals?status=${s}`} className={`pill${status === s ? ' on' : ''}`}>
              {s.replace(/_/g, ' ')} ({n})
            </Link>
          );
        })}
      </div>

      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-title">{deals.length} deals</div>
          <span className="small muted">Open a deal for the full management view</span>
        </div>
        {deals.length === 0 ? (
          <div className="empty-state"><span className="ico">💼</span>No deals yet.</div>
        ) : (
          <table className="deal-list-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Brand</th>
                <th>Creator</th>
                <th>Booking</th>
                <th>Total</th>
                <th>Current status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const creator = creatorById.get(d.creator_id);
                const response = d.creator_response_status ?? 'accepted';
                return (
                  <tr className="deal-row" key={d.id}>
                    <td>
                      <strong>{d.deal_ref}</strong>
                      <div className="deal-list-meta">{formatDateTime(d.created_at)}</div>
                    </td>
                    <td>
                      <strong>{d.brand_name ?? '—'}</strong>
                      <div className="deal-list-meta deal-list-break">{d.brand_email ?? 'No email'}</div>
                    </td>
                    <td>
                      {creator ? (
                        <Link href={`/admin/creators/${creator.id}`} className="deal-list-link">
                          {creator.name}
                        </Link>
                      ) : '—'}
                      <div className="deal-list-meta">{creator?.handle ?? 'Creator unavailable'}</div>
                    </td>
                    <td>
                      <strong>{d.content_type ?? 'Booking'}</strong>
                      <div className="deal-list-meta">{d.deliverables ?? 'No deliverables provided'}</div>
                    </td>
                    <td>
                      <strong>{money(d.total_usd)}</strong>
                      <div className="deal-list-meta">Due {formatDate(d.due_date)}</div>
                    </td>
                    <td>
                      <div className="deal-list-statuses">
                        <StatusBadge status={d.status} />
                        <StatusBadge status={d.payment_status} />
                        <StatusBadge status={response} />
                      </div>
                    </td>
                    <td>
                      <Link href={`/admin/deals/${d.id}`} className="btn btn-primary btn-sm">
                        View details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
