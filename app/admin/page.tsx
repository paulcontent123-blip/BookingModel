import Link from 'next/link';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboard() {
  const [creators, deals, requests, applicants, invoices, emails] = await Promise.all([
    db.list('creators', { limit: 1000 }),
    db.list('deals', { orderBy: 'created_at', ascending: false, limit: 500 }),
    db.list('booking_requests', { orderBy: 'created_at', ascending: false, limit: 100 }),
    db.list('applicants', { orderBy: 'applied_at', ascending: false, limit: 100 }),
    db.list('invoices', { limit: 500 }),
    db.list('email_log', { orderBy: 'created_at', ascending: false, limit: 6 }),
  ]);

  const paid = deals.filter((d) => d.payment_status === 'paid');
  const revenue = paid.reduce((s, d) => s + d.total_usd, 0);
  const fees = paid.reduce((s, d) => s + d.platform_fee_usd, 0);

  const thisMonth = paid.filter(
    (d) => new Date(d.created_at).getMonth() === new Date().getMonth(),
  );

  const notNotified = paid.filter((d) => !d.creator_notified_at);

  return (
    <>
      <h1 className="pg-title">Dashboard</h1>
      <p className="pg-sub">
        {config.site.name} internal — creator database, bookings, regional leads and system status.
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="sc-n">{creators.filter((c) => c.status === 'active').length}</div>
          <div className="sc-l">Active creators</div>
          <div className="sc-d">{creators.length} in database</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{paid.length}</div>
          <div className="sc-l">Paid bookings</div>
          <div className="sc-d blue">{thisMonth.length} this month</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{money(revenue)}</div>
          <div className="sc-l">Total booking value</div>
          <div className="sc-d">{money(fees)} platform fees</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{requests.filter((r) => r.status === 'new').length}</div>
          <div className="sc-l">Regional leads to action</div>
          <div className="sc-d amber">{requests.length} total</div>
        </div>
      </div>

      {notNotified.length > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          <strong>{notNotified.length} paid booking(s) have no creator notification recorded.</strong>{' '}
          Check the email log and contact those creators manually:{' '}
          {notNotified.slice(0, 5).map((d) => d.deal_ref).join(', ')}.
        </div>
      )}

      <div className="qa-grid">
        <Link href="/admin/creators/new" className="qa-card">
          <div className="qa-ico">➕</div>
          <div className="qa-label">Add creator</div>
          <div className="qa-sub">Manual profile entry</div>
        </Link>
        <Link href="/admin/import" className="qa-card">
          <div className="qa-ico">📥</div>
          <div className="qa-label">Import creators</div>
          <div className="qa-sub">CSV / Excel bulk upload</div>
        </Link>
        <Link href="/admin/applicants" className="qa-card">
          <div className="qa-ico">📝</div>
          <div className="qa-label">Review applicants</div>
          <div className="qa-sub">
            {applicants.filter((a) => a.status === 'pending').length} pending
          </div>
        </Link>
        <Link href="/admin/booking-requests" className="qa-card">
          <div className="qa-ico">🌏</div>
          <div className="qa-label">Regional requests</div>
          <div className="qa-sub">Leads that could not check out</div>
        </Link>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-title">Recent bookings</div>
          <Link href="/admin/deals" className="btn btn-ghost btn-sm">View all</Link>
        </div>
        {deals.length === 0 ? (
          <div className="empty-state"><span className="ico">💼</span>No bookings yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Deal</th><th>Brand</th><th>Creator</th><th>Value</th>
                <th>Origin</th><th>Status</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {await Promise.all(
                deals.slice(0, 6).map(async (d) => {
                  const creator = await db.get('creators', d.creator_id);
                  return (
                    <tr className="deal-row" key={d.id}>
                      <td>{d.deal_ref}</td>
                      <td>{d.brand_name}</td>
                      <td>{creator?.name ?? '—'}</td>
                      <td>{money(d.total_usd)}</td>
                      <td>{d.origin_country ?? '—'}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>{formatDateTime(d.created_at)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-title">Latest notifications sent</div>
          <Link href="/admin/emails" className="btn btn-ghost btn-sm">Email log</Link>
        </div>
        {emails.length === 0 ? (
          <div className="empty-state"><span className="ico">📮</span>No emails yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>To</th><th>Subject</th><th>Template</th><th>Provider</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>{e.to_email}</td>
                  <td>{e.subject}</td>
                  <td><span className="badge badge-gray">{e.template}</span></td>
                  <td>{e.provider}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>{formatDateTime(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Quick numbers</div>
        <div className="stat-grid" style={{ marginBottom: 0 }}>
          <div><div className="sc-n" style={{ fontSize: 22 }}>{invoices.length}</div><div className="sc-l">Invoices issued</div></div>
          <div><div className="sc-n" style={{ fontSize: 22 }}>{applicants.length}</div><div className="sc-l">Applicants</div></div>
          <div><div className="sc-n" style={{ fontSize: 22 }}>{creators.filter((c) => !c.contact_verified).length}</div><div className="sc-l">Creators with unverified contact</div></div>
          <div><div className="sc-n" style={{ fontSize: 22 }}>{config.geo.allowedCountries.join(', ')}</div><div className="sc-l">Checkout regions</div></div>
        </div>
      </div>
    </>
  );
}
