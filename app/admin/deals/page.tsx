import Link from 'next/link';
import { db } from '@/lib/db';
import { feePercentLabel, formatDate, formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import { resendCreatorNotificationAction, updateDealStatusAction } from '@/lib/services/admin-actions';
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

  const [creators, invoices] = await Promise.all([
    db.list('creators', { limit: 1000 }),
    db.list('invoices', { limit: 1000 }),
  ]);
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const invoiceByDeal = new Map(invoices.map((i) => [i.deal_id, i]));

  const paid = all.filter((d) => d.payment_status === 'paid');
  const gross = paid.reduce((s, d) => s + d.total_usd, 0);
  const fees = paid.reduce((s, d) => s + d.platform_fee_usd, 0);
  const avg = paid.length ? Math.round(gross / paid.length) : 0;
  // Deals span several fee tiers, so show the blended rate actually collected.
  const feeBase = paid.reduce((s, d) => s + d.subtotal_usd, 0);
  const blendedFee = feeBase ? (fees * 100) / feeBase : 0;

  return (
    <>
      <h1 className="pg-title">Booking Deals</h1>
      <p className="pg-sub">
        Every paid booking made through the platform. Creator notifications are sent automatically
        at payment; re-send here if delivery failed.
      </p>

      <div className="stat-grid">
        <div className="stat-card"><div className="sc-n">{money(gross)}</div><div className="sc-l">Total booking value</div></div>
        <div className="stat-card"><div className="sc-n">{paid.length}</div><div className="sc-l">Paid deals</div></div>
        <div className="stat-card"><div className="sc-n">{money(avg)}</div><div className="sc-l">Average deal size</div></div>
        <div className="stat-card">
          <div className="sc-n">{money(fees)}</div>
          <div className="sc-l">Platform fees ({feePercentLabel(blendedFee)}% blended)</div>
        </div>
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
        <div className="tbl-head"><div className="tbl-title">{deals.length} deals</div></div>
        {deals.length === 0 ? (
          <div className="empty-state"><span className="ico">💼</span>No deals yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Deal</th><th>Brand</th><th>Creator</th><th>Deliverables</th>
                <th>Value</th><th>Payment</th><th>Origin</th><th>Notified</th>
                <th>Due</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const creator = creatorById.get(d.creator_id);
                const invoice = invoiceByDeal.get(d.id);
                return (
                  <tr className="deal-row" key={d.id}>
                    <td>
                      {d.deal_ref}
                      <div style={{ fontSize: 10.5, color: 'var(--muted2)', fontFamily: 'var(--mont)' }}>
                        {formatDateTime(d.created_at)}
                      </div>
                    </td>
                    <td>
                      {d.brand_name}
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{d.brand_email}</div>
                    </td>
                    <td>
                      {creator ? (
                        <Link href={`/admin/creators/${creator.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                          {creator.name}
                        </Link>
                      ) : '—'}
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        {creator?.contact_email ?? 'no email on file'}
                      </div>
                    </td>
                    <td>{d.deliverables}</td>
                    <td>
                      {money(d.total_usd)}
                      <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        fee {money(d.platform_fee_usd)}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={d.payment_status} />
                      <div style={{ fontSize: 10.5, color: 'var(--muted2)' }}>{d.payment_provider}</div>
                    </td>
                    <td>{d.origin_country ?? '—'}</td>
                    <td>
                      {d.creator_notified_at ? (
                        <span className="badge badge-green">sent</span>
                      ) : (
                        <span className="badge badge-red">not sent</span>
                      )}
                    </td>
                    <td>{formatDate(d.due_date)}</td>
                    <td>
                      <ActionSelect
                        value={d.status}
                        options={STATUSES}
                        action={async (next) => {
                          'use server';
                          return updateDealStatusAction(d.id, next as DealStatus);
                        }}
                      />
                    </td>
                    <td>
                      <div className="btn-row">
                        {invoice && (
                          <Link href={`/invoices/${invoice.invoice_no}`} className="btn btn-ghost btn-xs">
                            Invoice
                          </Link>
                        )}
                        <ActionButton
                          label="Re-send brief"
                          pendingLabel="Sending…"
                          action={async () => {
                            'use server';
                            return resendCreatorNotificationAction(d.id);
                          }}
                        />
                      </div>
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
