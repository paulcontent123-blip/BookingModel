import Link from 'next/link';
import { db } from '@/lib/db';
import { CATEGORIES, CONTENT_TYPES, formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import {
  createCampaignAction,
  deleteCampaignAction,
  updateCampaignStatusAction,
} from '@/lib/services/admin-actions';
import { CampaignBuilder } from '@/components/admin/campaign-builder';

export const metadata = { title: 'All Campaigns' };

const STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [sp, allCampaigns] = await Promise.all([
    searchParams,
    db.list('campaigns', { orderBy: 'created_at', ascending: false }),
  ]);
  const q = (sp.q ?? '').trim().toLowerCase();
  const campaigns = q
    ? allCampaigns.filter((campaign) =>
        [campaign.brand_name, campaign.title]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      )
    : allCampaigns;

  return (
    <>
      <h1 className="pg-title">Campaigns</h1>
      <p className="pg-sub">
        Brand campaigns that creators apply to. Publishing pushes a campaign to the public
        &ldquo;Open Campaigns&rdquo; page.
      </p>

      <form className="filter-bar" method="get">
        <input
          name="q"
          placeholder="Search by brand or campaign name…"
          defaultValue={sp.q ?? ''}
          aria-label="Search campaigns by brand or campaign name"
        />
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
        {q && <Link href="/admin/campaigns" className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      <div className="brief-grid">
        <div className="tbl-wrap">
          <div className="tbl-head">
            <div className="tbl-title">
              {q ? `${campaigns.length} of ${allCampaigns.length} campaigns` : `${campaigns.length} campaigns`}
            </div>
          </div>
          {campaigns.length === 0 ? (
            <div className="empty-state">
              <span className="ico">{q ? '🔍' : '🚀'}</span>
              {q ? 'No campaigns match your search.' : 'No campaigns yet.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Campaign</th><th>Brand</th><th>Platform</th><th>Spots</th>
                  <th>Rate</th><th>Budget</th><th>Status</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="admin-campaign-cell">
                        {c.cover_url ? (
                          <img src={c.cover_url} alt="" className="admin-campaign-thumb" />
                        ) : (
                          <span className="admin-campaign-thumb admin-campaign-thumb-empty" aria-hidden="true" />
                        )}
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                            {c.category} · {c.content_type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{c.brand_name}</td>
                    <td>{c.platform}</td>
                    <td>{c.spots_filled}/{c.spots_total}</td>
                    <td>{c.rate_label ?? '—'}</td>
                    <td>{c.budget_usd ? money(c.budget_usd) : '—'}</td>
                    <td>
                      <div className="row gap-6">
                        <StatusBadge status={c.status} />
                        <ActionSelect
                          value={c.status}
                          options={[...STATUSES]}
                          action={async (next) => {
                            'use server';
                            return updateCampaignStatusAction(
                              c.id,
                              next as (typeof STATUSES)[number],
                            );
                          }}
                        />
                      </div>
                    </td>
                    <td>{formatDateTime(c.created_at)}</td>
                    <td>
                      <div className="row gap-6">
                        <Link href={`/admin/campaigns/${c.id}`} className="btn btn-ghost btn-xs">
                          Edit
                        </Link>
                        <ActionButton
                          label="Delete"
                          pendingLabel="Deleting…"
                          className="btn btn-danger btn-xs"
                          confirm={`Delete "${c.title}"? This cannot be undone. Campaigns with booking history cannot be deleted.`}
                          action={async () => {
                            'use server';
                            return deleteCampaignAction(c.id);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="brief-sidebar">
          <CampaignBuilder
            action={createCampaignAction}
            categories={[...CATEGORIES]}
            contentTypes={[...CONTENT_TYPES]}
          />
        </div>
      </div>
    </>
  );
}
