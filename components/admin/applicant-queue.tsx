import Link from 'next/link';
import { db } from '@/lib/db';
import { decideApplicantAction } from '@/lib/services/admin-actions';
import { ActionButton } from '@/components/admin/action-button';
import { StatusBadge } from '@/components/status-badge';
import { formatDateTime, initials } from '@/lib/utils';

export type ApplicantQueueMode = 'roster' | 'campaign';

/** Shared admin queue for the two public creator application sources. */
export async function ApplicantQueue({
  mode,
  searchParams,
}: {
  mode: ApplicantQueueMode;
  searchParams: { status?: string };
}) {
  const [allApplicants, campaigns] = await Promise.all([
    db.list('applicants', { orderBy: 'applied_at', ascending: false }),
    db.list('campaigns'),
  ]);

  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const sourceApplicants = allApplicants.filter((applicant) =>
    mode === 'campaign' ? Boolean(applicant.campaign_id) : !applicant.campaign_id,
  );
  const status = searchParams.status;
  const applicants = status
    ? sourceApplicants.filter((applicant) => applicant.status === status)
    : sourceApplicants;
  const counts = {
    pending: sourceApplicants.filter((applicant) => applicant.status === 'pending').length,
    approved: sourceApplicants.filter((applicant) => applicant.status === 'approved').length,
    rejected: sourceApplicants.filter((applicant) => applicant.status === 'rejected').length,
  };
  const basePath = mode === 'campaign' ? '/admin/campaign-applicants' : '/admin/applicants';

  return (
    <>
      <h1 className="pg-title">
        {mode === 'campaign' ? 'Campaign Applicants' : 'KOL/KOC Applicants'}
      </h1>
      <p className="pg-sub">
        {mode === 'campaign'
          ? 'Creators who applied to a specific brand campaign. Approving creates a live creator profile and emails the applicant.'
          : 'Submissions from the public “Apply as a Creator” form. Approving creates a live creator profile and emails the applicant.'}
      </p>

      <div className="pill-bar">
        <Link href={basePath} className={`pill${!status ? ' on' : ''}`}>
          All ({sourceApplicants.length})
        </Link>
        {(['pending', 'approved', 'rejected'] as const).map((nextStatus) => (
          <Link
            key={nextStatus}
            href={`${basePath}?status=${nextStatus}`}
            className={`pill${status === nextStatus ? ' on' : ''}`}
          >
            {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)} ({counts[nextStatus]})
          </Link>
        ))}
      </div>

      {applicants.length === 0 ? (
        <div className="empty-state">
          <span className="ico">📝</span>
          No applicants{status ? ` with status “${status}”` : ''} yet.
        </div>
      ) : (
        applicants.map((applicant) => {
          const campaign = applicant.campaign_id ? campaignById.get(applicant.campaign_id) : null;

          return (
            <div className="app-card" key={applicant.id}>
              <div className="app-ava">
                {applicant.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={applicant.photo_url} alt={applicant.name} />
                ) : (
                  initials(applicant.name)
                )}
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {applicant.name}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--muted2)', fontSize: 12.5 }}>
                    {applicant.handle}
                  </span>
                </div>
                {campaign && (
                  <div className="app-campaign-context">
                    {campaign.brand_name} · {campaign.title}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                  {applicant.platform} · {applicant.niche} · {applicant.audience ?? '—'} followers · ER {applicant.er ?? '—'} · asks {applicant.rate ?? '—'}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 5 }}>
                  ✉ {applicant.email}
                  {applicant.phone && <> · 📞 {applicant.phone}</>}
                  {applicant.country && <> · 🌐 {applicant.country}</>}
                </div>
                <div className="btn-row" style={{ marginTop: 7 }}>
                  {applicant.channel_url && (
                    <a href={applicant.channel_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                      Channel ↗
                    </a>
                  )}
                  {applicant.video_url && (
                    <a href={applicant.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                      Portfolio video ↗
                    </a>
                  )}
                  {applicant.creator_id && (
                    <Link href={`/admin/creators/${applicant.creator_id}`} className="btn btn-ghost btn-xs">
                      Creator profile →
                    </Link>
                  )}
                </div>
                {applicant.notes && (
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
                    {applicant.notes}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={applicant.status} />
                <div style={{ fontSize: 11, color: 'var(--muted2)', margin: '6px 0 9px' }}>
                  {formatDateTime(applicant.applied_at)}
                </div>
                {applicant.status === 'pending' && (
                  <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                    <ActionButton
                      className="btn btn-green btn-sm"
                      label="Approve"
                      pendingLabel="Approving…"
                      confirm={`Approve ${applicant.name} and publish their profile to the marketplace?`}
                      action={async () => {
                        'use server';
                        return decideApplicantAction(applicant.id, 'approved');
                      }}
                    />
                    <ActionButton
                      className="btn btn-danger btn-sm"
                      label="Reject"
                      pendingLabel="Rejecting…"
                      confirm={`Reject ${applicant.name}? They receive a notification email.`}
                      action={async () => {
                        'use server';
                        return decideApplicantAction(applicant.id, 'rejected');
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
