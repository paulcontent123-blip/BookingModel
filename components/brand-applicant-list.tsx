import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser, revealedApplicantIdsToday, revealQuota } from '@/lib/auth';
import { lowestPlanWith, planName, revealLimitLabel, upgradeTargets } from '@/lib/plans';
import { initials } from '@/lib/utils';
import { RevealApplicantContactButton } from '@/components/reveal-applicant-contact-button';

export type BrandApplicantMode = 'campaign' | 'roster';

function belongsToBrand(
  campaign: { brand_id: string | null; brand_name: string | null },
  user: { id: string; company_name: string | null },
) {
  return campaign.brand_id === user.id || (
    campaign.brand_id == null &&
    Boolean(user.company_name) &&
    campaign.brand_name === user.company_name
  );
}

function redactContact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gi, '[contact hidden]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[contact hidden]');
}

function statusClass(status: string): string {
  if (status === 'approved') return 'active';
  if (status === 'pending') return 'pending';
  return 'error';
}

export async function BrandApplicantList({ mode }: { mode: BrandApplicantMode }) {
  const user = await requireUser();
  const [allApplicants, campaigns, quota, revealedApplicants] = await Promise.all([
    db.list('applicants', { orderBy: 'applied_at', ascending: false }),
    db.list('campaigns', { orderBy: 'created_at', ascending: false }),
    revealQuota(user),
    revealedApplicantIdsToday(user.id),
  ]);

  const ownedCampaigns = campaigns.filter((campaign) => belongsToBrand(campaign, user));
  const ownedCampaignIds = new Set(ownedCampaigns.map((campaign) => campaign.id));
  const campaignById = new Map(ownedCampaigns.map((campaign) => [campaign.id, campaign]));
  const applicants = allApplicants.filter((applicant) => {
    if (applicant.status === 'rejected') return false;
    if (mode === 'campaign') return Boolean(applicant.campaign_id) && ownedCampaignIds.has(applicant.campaign_id!);
    return !applicant.campaign_id;
  });

  const contactPlan = planName(lowestPlanWith('contact_reveals') ?? 'standard');
  const nextPlan = upgradeTargets(user.plan)[0];
  const upgradeLabel = nextPlan ? `Upgrade to ${nextPlan.name} →` : 'View plan options →';

  return (
    <div className="brand-dashboard-subpage brand-dashboard-wide">
      <div className="brand-dashboard-page-header">
        <div>
          <h1>{mode === 'campaign' ? 'Campaign Applicants' : 'Creator Applications'}</h1>
          <p>
            {mode === 'campaign'
              ? 'Creators who applied to your published campaigns. Contact details stay private until you unlock them.'
              : 'Creators who submitted the public “Apply as a Creator” form. Review their basic profile before unlocking contact details.'}
          </p>
        </div>
      </div>

      <div className="brand-dashboard-plan-note">
        {!quota.entitled ? (
          <>Contact details are hidden on the {planName(user.plan)} plan. They start on the {contactPlan} plan.{' '}<Link href="/dashboard/plan">{upgradeLabel}</Link></>
        ) : quota.unlimited ? (
          <>Unlimited contact reveals on your plan — {revealedApplicants.size} applicants unlocked today.</>
        ) : (
          <>{quota.used} of {revealLimitLabel(user.plan)} contact reveals used today. {quota.remaining} left.{' '}<Link href="/dashboard/plan">{upgradeLabel}</Link></>
        )}
      </div>

      {mode === 'campaign' && ownedCampaigns.length === 0 && (
        <div className="brand-dashboard-alert warning">
          You do not have any campaigns yet. Create a campaign brief and ask the VEA team to publish it.
        </div>
      )}

      {applicants.length === 0 ? (
        <div className="brand-dashboard-empty-card">
          <div className="brand-dashboard-empty-icon">{mode === 'campaign' ? '🎯' : '👤'}</div>
          {mode === 'campaign' ? 'No creators have applied to your campaigns yet.' : 'No creator applications yet.'}
          <small>{mode === 'campaign' ? 'Applications will appear here after a creator applies to one of your campaigns.' : 'New public creator applications will appear here.'}</small>
        </div>
      ) : (
        <div className="brand-applicant-grid">
          {applicants.map((applicant) => {
            const campaign = applicant.campaign_id ? campaignById.get(applicant.campaign_id) : null;
            const unlocked = quota.unlimited || revealedApplicants.has(applicant.id);

            return (
              <article className="brand-applicant-card" key={applicant.id}>
                <div className="brand-applicant-topline">
                  <div className="brand-applicant-avatar">
                    {applicant.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={applicant.photo_url} alt={applicant.name} />
                    ) : initials(applicant.name)}
                  </div>
                  <div className="brand-applicant-heading">
                    <strong>{applicant.name}</strong>
                    <span>{applicant.handle ?? '—'}</span>
                  </div>
                  <span className={`brand-dashboard-status ${statusClass(applicant.status)}`}>
                    {applicant.status}
                  </span>
                </div>

                {campaign ? (
                  <div className="brand-applicant-campaign">
                    <span>Applied to</span>
                    <strong>{campaign.title}</strong>
                    <small>{campaign.brand_name}</small>
                  </div>
                ) : (
                  <div className="brand-applicant-campaign">
                    <span>Source</span>
                    <strong>Apply as a Creator</strong>
                    <small>General creator roster</small>
                  </div>
                )}

                <div className="brand-applicant-details">
                  <div><span>Platform</span><strong>{applicant.platform ?? '—'}</strong></div>
                  <div><span>Niche</span><strong>{applicant.niche ?? '—'}</strong></div>
                  <div><span>Followers</span><strong>{applicant.audience ?? '—'}</strong></div>
                  <div><span>Engagement</span><strong>{applicant.er ?? '—'}</strong></div>
                  <div><span>Rate</span><strong>{applicant.rate ?? '—'}</strong></div>
                  <div><span>Applied</span><strong>{new Date(applicant.applied_at).toLocaleDateString('en-US')}</strong></div>
                </div>

                {applicant.notes && (
                  <p className="brand-applicant-notes">{redactContact(applicant.notes)}</p>
                )}

                {unlocked ? (
                  <div className="brand-creator-contact">
                    ✉ {applicant.email}
                    {applicant.phone && <><br />📞 {applicant.phone}</>}
                  </div>
                ) : !quota.entitled ? (
                  <div className="brand-creator-contact locked">
                    <span>✉ Contact locked on {planName(user.plan)}</span>
                    <Link href="/dashboard/plan">{upgradeLabel}</Link>
                  </div>
                ) : quota.remaining === 0 ? (
                  <div className="brand-creator-contact locked">
                    <span>✉ Daily reveal quota used</span>
                    <Link href="/dashboard/plan">{upgradeLabel}</Link>
                  </div>
                ) : (
                  <RevealApplicantContactButton applicantId={applicant.id} applicantName={applicant.name} />
                )}

                <div className="brand-applicant-actions">
                  {applicant.channel_url && (
                    <a href={applicant.channel_url} target="_blank" rel="noopener noreferrer">View channel ↗</a>
                  )}
                  {applicant.video_url && (
                    <a href={applicant.video_url} target="_blank" rel="noopener noreferrer">Portfolio video ↗</a>
                  )}
                  {applicant.creator_id && (
                    <Link href={`/creators/${applicant.creator_id}`}>View profile →</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
