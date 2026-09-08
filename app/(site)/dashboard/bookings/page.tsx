import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatDate, money } from '@/lib/utils';

export const metadata: Metadata = { title: 'My Campaigns' };

function belongsToBrand(
  row: { brand_id: string | null; brand_name: string | null },
  user: { id: string; company_name: string | null },
) {
  return row.brand_id === user.id || (
    row.brand_id == null &&
    Boolean(user.company_name) &&
    row.brand_name === user.company_name
  );
}

function statusClass(status: string): string {
  if (['active', 'paid', 'accepted', 'approved', 'published', 'completed'].includes(status)) return 'active';
  if (['pending_payment', 'unpaid', 'brief_sent', 'negotiating', 'content_in_review'].includes(status)) return 'pending';
  if (['cancelled', 'failed', 'overdue'].includes(status)) return 'error';
  return 'draft';
}

export default async function BookingsPage() {
  const user = await requireUser();

  const [allCampaigns, allDeals, invoices] = await Promise.all([
    db.list('campaigns', { orderBy: 'created_at', ascending: false }),
    db.list('deals', { orderBy: 'created_at', ascending: false }),
    db.list('invoices', { limit: 500 }),
  ]);
  const campaigns = allCampaigns.filter((campaign) => belongsToBrand(campaign, user));
  // Match on the account id, and also on the email used at checkout so a
  // booking made before signing in still shows up.
  const deals = allDeals.filter((deal) => deal.brand_id === user.id || deal.brand_email === user.email);

  const invoiceFor = new Map(invoices.map((i) => [i.deal_id, i]));
  const spendFor = new Map<string, number>();
  for (const deal of deals) {
    if (deal.campaign_id) spendFor.set(deal.campaign_id, (spendFor.get(deal.campaign_id) ?? 0) + deal.total_usd);
  }

  return (
    <div className="brand-dashboard-subpage brand-dashboard-wide">
      <div className="brand-dashboard-page-header">
        <div>
          <h1>My Campaigns</h1>
          <p>Track your active and past campaigns.</p>
        </div>
        <Link href="/dashboard/brief" className="brand-dashboard-primary-link">+ New Campaign</Link>
      </div>

      <div className="brand-dashboard-table-card">
        <div className="brand-dashboard-table-head">
          <strong>All campaigns ({campaigns.length})</strong>
          <Link href="/dashboard/brief">Create brief →</Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="brand-dashboard-table-empty">
            You have no campaigns yet. <Link href="/dashboard/brief">Create your first campaign brief →</Link>
          </div>
        ) : (
          <div className="brand-dashboard-table-scroll">
            <table className="brand-dashboard-table">
              <thead>
                <tr><th>Campaign</th><th>Platform</th><th>Creators</th><th>Budget</th><th>Spend</th><th>Status</th></tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <strong>{campaign.emoji} {campaign.title}</strong>
                      <small>{campaign.category ?? 'General'} · {campaign.content_type ?? 'Campaign brief'}</small>
                    </td>
                    <td>{campaign.platform ?? '—'}</td>
                    <td>{campaign.spots_filled} / {campaign.spots_total}</td>
                    <td>{campaign.budget_usd ? money(campaign.budget_usd) : '—'}</td>
                    <td>{spendFor.has(campaign.id) ? money(spendFor.get(campaign.id)) : '—'}</td>
                    <td><span className={`brand-dashboard-status ${statusClass(campaign.status)}`}>{campaign.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="brand-dashboard-table-card brand-dashboard-bookings-card">
        <div className="brand-dashboard-table-head">
          <strong>Recent bookings ({deals.length})</strong>
        </div>
        {deals.length === 0 ? (
          <div className="brand-dashboard-table-empty">
            No bookings yet. <Link href="/dashboard/creators">Browse creators →</Link>
          </div>
        ) : (
          <div className="brand-dashboard-table-scroll">
            <table className="brand-dashboard-table">
              <thead>
                <tr>
                  <th>Reference</th><th>Creator</th><th>Deliverables</th><th>Total</th>
                  <th>Payment</th><th>Creator response</th><th>Status</th><th>Due</th><th />
                </tr>
              </thead>
              <tbody>
                {await Promise.all(
                  deals.map(async (deal) => {
                    const creator = await db.get('creators', deal.creator_id);
                    const invoice = invoiceFor.get(deal.id);
                    return (
                      <tr key={deal.id}>
                        <td className="brand-dashboard-mono">{deal.deal_ref}</td>
                        <td>{creator ? `${creator.name} (${creator.handle})` : '—'}</td>
                        <td>{deal.deliverables ?? '—'}</td>
                        <td>{money(deal.total_usd)}</td>
                        <td><span className={`brand-dashboard-status ${statusClass(deal.payment_status)}`}>{deal.payment_status.replace(/_/g, ' ')}</span></td>
                        <td><span className={`brand-dashboard-status ${statusClass(deal.creator_response_status ?? 'accepted')}`}>{(deal.creator_response_status ?? 'accepted').replace(/_/g, ' ')}</span></td>
                        <td><span className={`brand-dashboard-status ${statusClass(deal.status)}`}>{deal.status.replace(/_/g, ' ')}</span></td>
                        <td>{formatDate(deal.due_date)}</td>
                        <td>
                          <div className="brand-dashboard-table-actions">
                            <Link href={`/booking/success/${deal.deal_ref}`} className="brand-dashboard-table-link">Details</Link>
                            {invoice && <Link href={`/invoices/${invoice.invoice_no}`} className="brand-dashboard-table-link">Invoice</Link>}
                          </div>
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
