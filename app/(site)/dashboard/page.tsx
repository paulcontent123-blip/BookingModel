import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser, revealQuota, userHasFeature } from '@/lib/auth';
import { planName, revealLimitLabel } from '@/lib/plans';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

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
  if (status === 'active') return 'active';
  if (status === 'completed') return 'completed';
  if (status === 'paused') return 'paused';
  return 'draft';
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [allCampaigns, allDeals, quota] = await Promise.all([
    db.list('campaigns', { orderBy: 'created_at', ascending: false }),
    db.list('deals', { orderBy: 'created_at', ascending: false, limit: 500 }),
    revealQuota(user),
  ]);

  const campaigns = allCampaigns.filter((campaign) => belongsToBrand(campaign, user));
  const deals = allDeals.filter((deal) => deal.brand_id === user.id || deal.brand_email === user.email);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const creatorsBooked = deals.reduce((sum, deal) => sum + (deal.quantity || 0), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSpend = deals
    .filter((deal) => new Date(deal.created_at).getTime() >= monthStart.getTime())
    .reduce((sum, deal) => sum + (deal.total_usd || 0), 0);
  // Analytics (spend reporting) is a Pro entitlement; the quota tile always
  // shows this plan's real limit, which is 0 on Free.
  const showAnalytics = userHasFeature(user, 'analytics');
  const contactLimit = quota.unlimited ? '∞' : revealLimitLabel(user.plan);

  return (
    <div className="brand-dashboard-overview">
      <div className="brand-dashboard-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user.company_name ?? user.full_name ?? user.email}. Here is your campaign overview.</p>
        </div>
        <Link href="/dashboard/brief" className="brand-dashboard-primary-link">+ New Campaign Brief</Link>
      </div>

      <div className="brand-dashboard-stat-grid">
        <div className="brand-dashboard-stat-card">
          <strong>{activeCampaigns}</strong>
          <span>Active campaigns</span>
          <small>{campaigns.length} total campaigns</small>
        </div>
        <div className="brand-dashboard-stat-card">
          <strong>{creatorsBooked}</strong>
          <span>Creators booked total</span>
          <small>{deals.length} booking records</small>
        </div>
        {showAnalytics ? (
          <div className="brand-dashboard-stat-card">
            <strong>{money(monthSpend)}</strong>
            <span>Campaign spend this month</span>
            <small>{monthSpend ? 'Based on your bookings' : 'No spend recorded yet'}</small>
          </div>
        ) : (
          <div className="brand-dashboard-stat-card locked">
            <strong>—</strong>
            <span>Campaign spend this month</span>
            <small>
              <Link href="/dashboard/plan">Analytics is part of Pro →</Link>
            </small>
          </div>
        )}
        <div className="brand-dashboard-stat-card">
          <strong>{quota.used}/{contactLimit}</strong>
          <span>Creator contacts used today</span>
          <small>
            {!quota.entitled
              ? `Contacts are locked on ${planName(user.plan)}`
              : quota.unlimited
                ? 'Unlimited on your plan'
                : 'Resets at midnight UTC'}
          </small>
        </div>
      </div>

      <div className="brand-dashboard-quick-grid">
        <Link href="/dashboard/creators" className="brand-dashboard-quick-card">
          <span className="brand-dashboard-quick-icon">👥</span>
          <strong>Browse Creators</strong>
          <small>Search the vetted creator roster</small>
        </Link>
        <Link href="/dashboard/bookings" className="brand-dashboard-quick-card">
          <span className="brand-dashboard-quick-icon">🚀</span>
          <strong>My Campaigns</strong>
          <small>{activeCampaigns} active · manage your briefs</small>
        </Link>
        <Link href="/dashboard/brief" className="brand-dashboard-quick-card">
          <span className="brand-dashboard-quick-icon">✏️</span>
          <strong>New Campaign Brief</strong>
          <small>Tell us what creators you need</small>
        </Link>
        <Link href="/dashboard/plan" className="brand-dashboard-quick-card">
          <span className="brand-dashboard-quick-icon">💳</span>
          <strong>My Plan</strong>
          <small>Manage your plan and contact access</small>
        </Link>
      </div>

      <div className="brand-dashboard-table-card">
        <div className="brand-dashboard-table-head">
          <strong>Recent campaigns</strong>
          <Link href="/dashboard/bookings">View all →</Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="brand-dashboard-table-empty">
            No campaigns yet. <Link href="/dashboard/brief">Create your first brief →</Link>
          </div>
        ) : (
          <div className="brand-dashboard-table-scroll">
            <table className="brand-dashboard-table">
              <thead>
                <tr><th>Campaign</th><th>Platform</th><th>Creators</th><th>Budget</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 5).map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <strong>{campaign.emoji} {campaign.title}</strong>
                      <small>{campaign.category ?? 'General'} · {campaign.content_type ?? 'Campaign brief'}</small>
                    </td>
                    <td>{campaign.platform ?? '—'}</td>
                    <td>{campaign.spots_filled} / {campaign.spots_total}</td>
                    <td>{campaign.budget_usd ? money(campaign.budget_usd) : '—'}</td>
                    <td><span className={`brand-dashboard-status ${statusClass(campaign.status)}`}>{campaign.status}</span></td>
                    <td><Link href="/dashboard/bookings" className="brand-dashboard-table-link">Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
