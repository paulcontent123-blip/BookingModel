import Link from 'next/link';
import { db } from '@/lib/db';
import { approveUpgradeRequestAction, rejectUpgradeRequestAction } from '@/lib/services/admin-actions';
import { ActionButton } from '@/components/admin/action-button';
import { StatusBadge } from '@/components/status-badge';
import { PLANS, planName } from '@/lib/plans';
import { selfServeCheckoutAvailable } from '@/lib/payments/subscriptions';
import { formatDateTime } from '@/lib/utils';
import type { UpgradeRequestStatus } from '@/lib/types';

export const metadata = { title: 'Plan Upgrade Requests' };

const STATUSES: UpgradeRequestStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

export default async function UpgradeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await db.list('upgrade_requests', { orderBy: 'created_at', ascending: false });
  const requests = status ? all.filter((r) => r.status === status) : all;
  const stripeLive = selfServeCheckoutAvailable();

  return (
    <>
      <h1 className="pg-title">Plan Upgrade Requests</h1>
      <p className="pg-sub">
        Brands asking to move to a higher plan. Approving changes the account&rsquo;s plan
        immediately and emails the brand — every gate (contact reveals, brief builder, shortlists,
        analytics, booking fee) follows within the same request.
      </p>

      <div
        className="card"
        style={{
          marginBottom: 16,
          fontSize: 12.5,
          lineHeight: 1.7,
          borderLeft: `3px solid var(--${stripeLive ? 'blue' : 'amber'})`,
        }}
      >
        {stripeLive ? (
          <>
            <strong>Stripe Checkout is live.</strong> Self-serve tiers (
            {PLANS.standard.name}, {PLANS.pro.name}) are charged and applied automatically — only{' '}
            {PLANS.enterprise.name} contracts and failed checkouts land here.
          </>
        ) : (
          <>
            <strong>Stripe is not configured.</strong> Every upgrade arrives here for manual review.
            Set a real <code>STRIPE_SECRET_KEY</code> to turn on self-serve checkout for{' '}
            {PLANS.standard.name} and {PLANS.pro.name}.
          </>
        )}
      </div>

      <div className="pill-bar">
        <Link href="/admin/upgrade-requests" className={`pill${!status ? ' on' : ''}`}>
          All ({all.length})
        </Link>
        {STATUSES.map((s) => {
          const n = all.filter((r) => r.status === s).length;
          return (
            <Link
              key={s}
              href={`/admin/upgrade-requests?status=${s}`}
              className={`pill${status === s ? ' on' : ''}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} ({n})
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <span className="ico">💳</span>
          No upgrade requests{status ? ` with status "${status}"` : ''} yet.
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Change</th>
                <th>Route</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.company_name ?? '—'}</strong>
                    <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{r.user_email}</div>
                    {r.note && (
                      <div style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 4 }}>
                        “{r.note}”
                      </div>
                    )}
                  </td>
                  <td>
                    {planName(r.from_plan)} → <strong>{planName(r.to_plan)}</strong>
                    <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                      {PLANS[r.to_plan].feePercent}% fee ·{' '}
                      {PLANS[r.to_plan].priceUsd === null
                        ? 'custom pricing'
                        : `${PLANS[r.to_plan].priceLabel}/mo`}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${r.source === 'sales' ? 'badge-amber' : 'badge-blue'}`}>
                      {r.source === 'sales' ? 'sales-led' : 'self-serve'}
                    </span>
                    {r.checkout_session_id && (
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>
                        checkout started
                      </div>
                    )}
                  </td>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    {r.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <ActionButton
                          className="btn btn-green btn-xs"
                          label={`Apply ${planName(r.to_plan)}`}
                          pendingLabel="Applying…"
                          confirm={`Move ${r.user_email} to the ${planName(r.to_plan)} plan? Billing is arranged separately.`}
                          action={approveUpgradeRequestAction.bind(null, r.id)}
                        />
                        <ActionButton
                          label="Reject"
                          confirm={`Reject the ${planName(r.to_plan)} request from ${r.user_email}?`}
                          action={rejectUpgradeRequestAction.bind(null, r.id)}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                        {r.decided_at ? formatDateTime(r.decided_at) : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
