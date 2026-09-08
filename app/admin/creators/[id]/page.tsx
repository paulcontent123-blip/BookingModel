import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { updateCreatorAction } from '@/lib/services/admin-actions';
import { CreatorForm } from '@/components/admin/creator-form';
import { formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export const metadata = { title: 'Edit Creator' };

export default async function EditCreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await db.get('creators', id);
  if (!creator) notFound();

  const [portfolio, deals] = await Promise.all([
    db.list('creator_portfolio', { where: { creator_id: id }, orderBy: 'sort_order' }),
    db.list('deals', { where: { creator_id: id }, orderBy: 'created_at', ascending: false }),
  ]);

  const earned = deals
    .filter((d) => d.payment_status === 'paid')
    .reduce((s, d) => s + d.subtotal_usd, 0);

  return (
    <>
      <Link href="/admin/creators" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, display: 'inline-block' }}>
        ← All creators
      </Link>

      <h1 className="pg-title">{creator.name}</h1>
      <p className="pg-sub">
        {creator.handle} · {creator.platform} ·{' '}
        <Link href={`/creators/${creator.id}`} style={{ color: 'var(--blue)' }}>
          View public profile ↗
        </Link>
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="sc-n">{deals.length}</div><div className="sc-l">Bookings</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{money(earned)}</div><div className="sc-l">Gross earned</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{portfolio.length}</div><div className="sc-l">Portfolio items</div>
        </div>
        <div className="stat-card">
          <div className="sc-n" style={{ fontSize: 18 }}>
            {creator.contact_verified ? '✅ Verified' : '⚠️ Unverified'}
          </div>
          <div className="sc-l">Contact status</div>
        </div>
      </div>

      {!creator.contact_email && (
        <div className="alert alert-error">
          <strong>No contact email.</strong> Bookings for this creator cannot be notified
          automatically — add an address before making the profile active.
        </div>
      )}

      <CreatorForm
        action={async (formData: FormData) => {
          'use server';
          return updateCreatorAction(id, formData);
        }}
        creator={creator}
        submitLabel="Save changes"
      />

      {deals.length > 0 && (
        <div className="tbl-wrap" style={{ marginTop: 24 }}>
          <div className="tbl-head"><div className="tbl-title">Booking history</div></div>
          <table>
            <thead>
              <tr><th>Deal</th><th>Brand</th><th>Deliverables</th><th>Creator fee</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr className="deal-row" key={d.id}>
                  <td>{d.deal_ref}</td>
                  <td>{d.brand_name}</td>
                  <td>{d.deliverables}</td>
                  <td>{money(d.subtotal_usd)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{formatDateTime(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
