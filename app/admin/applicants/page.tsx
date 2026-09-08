import Link from 'next/link';
import { db } from '@/lib/db';
import { decideApplicantAction } from '@/lib/services/admin-actions';
import { ActionButton } from '@/components/admin/action-button';
import { StatusBadge } from '@/components/status-badge';
import { formatDateTime, initials } from '@/lib/utils';

export const metadata = { title: 'KOL/KOC Applicants' };

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await db.list('applicants', { orderBy: 'applied_at', ascending: false });
  const applicants = status ? all.filter((a) => a.status === status) : all;

  const counts = {
    pending: all.filter((a) => a.status === 'pending').length,
    approved: all.filter((a) => a.status === 'approved').length,
    rejected: all.filter((a) => a.status === 'rejected').length,
  };

  return (
    <>
      <h1 className="pg-title">KOL/KOC Applicants</h1>
      <p className="pg-sub">
        Submissions from the public &ldquo;Apply as Creator&rdquo; form. Approving creates a live
        creator profile and emails the applicant.
      </p>

      <div className="pill-bar">
        <Link href="/admin/applicants" className={`pill${!status ? ' on' : ''}`}>
          All ({all.length})
        </Link>
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Link key={s} href={`/admin/applicants?status=${s}`} className={`pill${status === s ? ' on' : ''}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
          </Link>
        ))}
      </div>

      {applicants.length === 0 ? (
        <div className="empty-state">
          <span className="ico">📝</span>
          No applicants{status ? ` with status "${status}"` : ''} yet.
        </div>
      ) : (
        applicants.map((a) => (
          <div className="app-card" key={a.id}>
            <div className="app-ava">
              {a.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.photo_url} alt={a.name} />
              ) : (
                initials(a.name)
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                {a.name}{' '}
                <span style={{ fontWeight: 400, color: 'var(--muted2)', fontSize: 12.5 }}>
                  {a.handle}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                {a.platform} · {a.niche} · {a.audience ?? '—'} followers · ER {a.er ?? '—'} · asks {a.rate ?? '—'}
              </div>
              <div style={{ fontSize: 12.5, marginTop: 5 }}>
                ✉ {a.email}
                {a.phone && <> · 📞 {a.phone}</>}
                {a.country && <> · 🌐 {a.country}</>}
              </div>
              <div className="btn-row" style={{ marginTop: 7 }}>
                {a.channel_url && (
                  <a href={a.channel_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                    Channel ↗
                  </a>
                )}
                {a.video_url && (
                  <a href={a.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                    Portfolio video ↗
                  </a>
                )}
                {a.creator_id && (
                  <Link href={`/admin/creators/${a.creator_id}`} className="btn btn-ghost btn-xs">
                    Creator profile →
                  </Link>
                )}
              </div>
              {a.notes && (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
                  {a.notes}
                </p>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <StatusBadge status={a.status} />
              <div style={{ fontSize: 11, color: 'var(--muted2)', margin: '6px 0 9px' }}>
                {formatDateTime(a.applied_at)}
              </div>
              {a.status === 'pending' && (
                <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                  <ActionButton
                    className="btn btn-green btn-sm"
                    label="Approve"
                    pendingLabel="Approving…"
                    confirm={`Approve ${a.name} and publish their profile to the marketplace?`}
                    action={async () => {
                      'use server';
                      return decideApplicantAction(a.id, 'approved');
                    }}
                  />
                  <ActionButton
                    className="btn btn-danger btn-sm"
                    label="Reject"
                    pendingLabel="Rejecting…"
                    confirm={`Reject ${a.name}? They receive a notification email.`}
                    action={async () => {
                      'use server';
                      return decideApplicantAction(a.id, 'rejected');
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
