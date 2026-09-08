import { db } from '@/lib/db';
import { CATEGORIES, CONTENT_TYPES, formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionSelect } from '@/components/admin/action-button';
import { createCampaignAction, updateCampaignStatusAction } from '@/lib/services/admin-actions';
import { CampaignBuilder } from '@/components/admin/campaign-builder';

export const metadata = { title: 'All Campaigns' };

const STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export default async function AdminCampaignsPage() {
  const campaigns = await db.list('campaigns', { orderBy: 'created_at', ascending: false });

  return (
    <>
      <h1 className="pg-title">Campaigns</h1>
      <p className="pg-sub">
        Brand campaigns that creators apply to. Publishing pushes a campaign to the public
        &ldquo;Open Campaigns&rdquo; page.
      </p>

      <div className="brief-grid">
        <div className="tbl-wrap">
          <div className="tbl-head">
            <div className="tbl-title">{campaigns.length} campaigns</div>
          </div>
          {campaigns.length === 0 ? (
            <div className="empty-state"><span className="ico">🚀</span>No campaigns yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Campaign</th><th>Brand</th><th>Platform</th><th>Spots</th>
                  <th>Rate</th><th>Budget</th><th>Status</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.emoji} {c.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                        {c.category} · {c.content_type}
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
