import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { CATEGORIES, CONTENT_TYPES } from '@/lib/utils';
import { ActionButton } from '@/components/admin/action-button';
import { CampaignBuilder } from '@/components/admin/campaign-builder';
import { deleteCampaignAction, updateCampaignAction } from '@/lib/services/admin-actions';

export const metadata = { title: 'Edit Campaign' };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await db.get('campaigns', id);
  if (!campaign) notFound();

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/admin/campaigns" className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
            ← All campaigns
          </Link>
          <h1 className="pg-title">Edit campaign</h1>
          <p className="pg-sub">
            {campaign.brand_name ?? 'Unassigned brand'} · {campaign.spots_filled}/{campaign.spots_total} spots filled
          </p>
        </div>
        <ActionButton
          label="Delete campaign"
          pendingLabel="Deleting…"
          className="btn btn-danger"
          confirm={`Delete "${campaign.title}"? This cannot be undone. Campaigns with booking history cannot be deleted.`}
          successHref="/admin/campaigns"
          action={async () => {
            'use server';
            return deleteCampaignAction(campaign.id);
          }}
        />
      </div>

      <CampaignBuilder
        action={async (formData) => {
          'use server';
          return updateCampaignAction(campaign.id, formData);
        }}
        campaign={campaign}
        categories={[...CATEGORIES]}
        contentTypes={[...CONTENT_TYPES]}
        submitLabel="Save changes"
      />
    </>
  );
}
