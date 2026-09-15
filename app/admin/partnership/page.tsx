import Link from 'next/link';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { countryFlag } from '@/lib/geo';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import {
  deletePartnershipRequestAction,
  updatePartnershipStatusAction,
} from '@/lib/services/admin-actions';
import type { PartnershipRequest, PartnershipStatus } from '@/lib/types';

export const metadata = { title: 'Partnership Requests' };

const PAGE_SIZE = 10;
const STATUSES: PartnershipStatus[] = ['new', 'in_discussion', 'converted', 'closed'];

const STATUS_LABELS: Record<PartnershipStatus, string> = {
  new: 'New',
  in_discussion: 'In discussion',
  converted: 'Converted',
  closed: 'Closed',
};

function isPartnershipStatus(value: string | undefined): value is PartnershipStatus {
  return value != null && STATUSES.includes(value as PartnershipStatus);
}

function firstName(request: PartnershipRequest): string {
  return (request.name ?? 'there').trim().split(/\s+/)[0] || 'there';
}

function replyHref(request: PartnershipRequest): string {
  const subject = `BookingModel partnership — ${request.type ?? 'your inquiry'}`;
  const body = `Hi ${firstName(request)},\n\nThank you for reaching out to BookingModel about ${request.type ?? 'a partnership'}. I would be happy to discuss the next steps.\n\nBest,\nVEA Group`;
  return `mailto:${request.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Admin queue for leads submitted from the public Partnership page. */
export default async function PartnershipPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = isPartnershipStatus(rawStatus) ? rawStatus : undefined;
  const [allCount, ...statusCounts] = await Promise.all([
    db.count('partnership_requests'),
    ...STATUSES.map((item) => db.count('partnership_requests', { status: item })),
  ]);
  const countByStatus = Object.fromEntries(
    STATUSES.map((item, index) => [item, statusCounts[index]]),
  ) as Record<PartnershipStatus, number>;
  const matchingCount = status ? countByStatus[status] : allCount;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const requestedPage = Number.parseInt(rawPage ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const requests = await db.list('partnership_requests', {
    where: status ? { status } : undefined,
    orderBy: 'created_at',
    ascending: false,
    limit: PAGE_SIZE,
    offset: firstIndex,
  });
  const firstShown = matchingCount === 0 ? 0 : firstIndex + 1;
  const lastShown = Math.min(firstIndex + requests.length, matchingCount);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    return `/admin/partnership?${params.toString()}`;
  };

  return (
    <>
      <h1 className="pg-title">Partnership Requests</h1>
      <p className="pg-sub">
        Leads submitted from the public Partnership &amp; Collaboration page. Review the brief,
        reply by email, then move qualified requests into the campaign workflow. Showing{' '}
        {firstShown}–{lastShown} of {matchingCount} matching requests.
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="sc-n">{countByStatus.new}</div>
          <div className="sc-l">New requests</div>
          <div className="sc-d amber">Reply within 1 business day</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{countByStatus.in_discussion}</div>
          <div className="sc-l">In discussion</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{countByStatus.converted}</div>
          <div className="sc-l">Converted to campaign</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{allCount}</div>
          <div className="sc-l">Total requests</div>
        </div>
      </div>

      <div className="pill-bar">
        <Link href="/admin/partnership" className={`pill${!status ? ' on' : ''}`}>
          All ({allCount})
        </Link>
        {STATUSES.map((item) => (
          <Link
            key={item}
            href={`/admin/partnership?status=${item}`}
            className={`pill${status === item ? ' on' : ''}`}
          >
            {STATUS_LABELS[item]} ({countByStatus[item]})
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <span className="ico">🤝</span>
          {status ? `No ${STATUS_LABELS[status].toLowerCase()} requests.` : 'No partnership requests yet.'}
        </div>
      ) : (
        requests.map((request) => <PartnershipCard key={request.id} request={request} />)
      )}

      {matchingCount > PAGE_SIZE && (
        <nav className="pagination" aria-label="Partnership request pages">
          <Link
            href={pageHref(currentPage - 1)}
            className={currentPage === 1 ? 'disabled' : undefined}
            aria-label="Previous page"
            aria-disabled={currentPage === 1}
          >
            ←
          </Link>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              href={pageHref(page)}
              className={page === currentPage ? 'on' : undefined}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Link>
          ))}

          <Link
            href={pageHref(currentPage + 1)}
            className={currentPage === totalPages ? 'disabled' : undefined}
            aria-label="Next page"
            aria-disabled={currentPage === totalPages}
          >
            →
          </Link>
        </nav>
      )}
    </>
  );
}

function PartnershipCard({ request }: { request: PartnershipRequest }) {
  return (
    <article className="partnership-card">
      <div className="partnership-card-head">
        <div>
          <div className="partnership-card-title">{request.company ?? 'Independent partner'}</div>
          <div className="partnership-card-contact">
            {request.name ?? 'Name not provided'} ·{' '}
            <a href={`mailto:${request.email}`}>{request.email}</a>
            {request.phone && (
              <>
                {' · '}
                <a href={`tel:${request.phone.replace(/[^\d+]/g, '')}`}>{request.phone}</a>
              </>
            )}
          </div>
          <div className="partnership-card-meta">
            {countryFlag(request.country)} {request.country ?? 'Unknown origin'} ·{' '}
            {request.source === 'website' ? 'Public website' : request.source} ·{' '}
            {formatDateTime(request.created_at)}
          </div>
        </div>

        <div className="partnership-card-status">
          <StatusBadge status={request.status} />
          <ActionSelect
            value={request.status}
            options={STATUSES}
            action={async (next) => {
              'use server';
              return updatePartnershipStatusAction(request.id, next as PartnershipStatus);
            }}
          />
        </div>
      </div>

      <div className="partnership-card-grid">
        <DetailField label="Partnership type" value={request.type ?? '—'} />
        <DetailField label="Budget / deal size" value={request.budget ?? '—'} />
        <DetailField label="Email" value={request.email} />
        <DetailField label="Phone" value={request.phone ?? '—'} />
      </div>

      {request.description && (
        <div className="partnership-message">
          <div className="partnership-message-label">Request details</div>
          <p>{request.description}</p>
        </div>
      )}

      <div className="btn-row partnership-card-actions">
        <a className="btn btn-primary btn-sm" href={replyHref(request)}>
          Reply by email
        </a>
        {request.status !== 'converted' && request.status !== 'closed' && (
          <ActionButton
            label="Convert to Campaign"
            pendingLabel="Converting…"
            className="btn btn-ghost btn-sm"
            confirm={`Mark this request from ${request.company ?? request.email} as converted and open Campaign Builder?`}
            successHref="/admin/campaigns"
            action={async () => {
              'use server';
              return updatePartnershipStatusAction(request.id, 'converted');
            }}
          />
        )}
        {request.status === 'converted' && (
          <Link className="btn btn-ghost btn-sm" href="/admin/campaigns">
            Open Campaign Builder →
          </Link>
        )}
        <ActionButton
          label="Delete"
          pendingLabel="Deleting…"
          className="btn btn-danger btn-sm"
          confirm={`Delete the partnership request from ${request.company ?? request.email}? This cannot be undone.`}
          action={async () => {
            'use server';
            return deletePartnershipRequestAction(request.id);
          }}
        />
      </div>
    </article>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="partnership-field-label">{label}</div>
      <div className="partnership-field-value">{value}</div>
    </div>
  );
}
