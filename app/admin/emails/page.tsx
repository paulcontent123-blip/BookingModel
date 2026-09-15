import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { EmailPreview } from '@/components/admin/email-preview';

export const metadata = { title: 'Email Log' };

const EMAILS_PER_PAGE = 20;

/**
 * Every notification the platform produced — including the ones that were only
 * logged because RESEND_API_KEY is not set. This is how you verify requirements
 * #2 and #5 without a mail provider.
 */
export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; page?: string }>;
}) {
  const { template, page: pageParam } = await searchParams;
  const emailWhere = template ? { template } : undefined;
  const [totalMessages, delivered, logged, failed, templateRows, totalFiltered] = await Promise.all([
    db.count('email_log'),
    db.count('email_log', { status: 'sent' }),
    db.count('email_log', { status: 'logged' }),
    db.count('email_log', { status: 'failed' }),
    db.list('email_log', { limit: 1000 }),
    template ? db.count('email_log', { template }) : db.count('email_log'),
  ]);
  const templates = [...new Set(templateRows.map((e) => e.template).filter(Boolean))] as string[];
  const totalPages = Math.max(1, Math.ceil(totalFiltered / EMAILS_PER_PAGE));
  const requestedPage = Number.parseInt(pageParam ?? '1', 10);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const emails = await db.list('email_log', {
    where: emailWhere,
    orderBy: 'created_at',
    ascending: false,
    limit: EMAILS_PER_PAGE,
    offset: (page - 1) * EMAILS_PER_PAGE,
  });

  function emailHref(nextTemplate: string | undefined, nextPage: number): string {
    const params = new URLSearchParams();
    if (nextTemplate) params.set('template', nextTemplate);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    return `/admin/emails${query ? `?${query}` : ''}`;
  }

  return (
    <>
      <h1 className="pg-title">Email Log</h1>
      <p className="pg-sub">
        {config.email.enabled ? (
          <>Delivered through Resend from {config.email.from}.</>
        ) : (
          <>
            <strong>No RESEND_API_KEY set</strong> — messages are recorded here and printed to the
            server console instead of being delivered. Add a key in <code>.env.local</code> to send
            for real.
          </>
        )}
      </p>

      <div className="stat-grid">
        <div className="stat-card"><div className="sc-n">{totalMessages}</div><div className="sc-l">Messages</div></div>
        <div className="stat-card">
          <div className="sc-n">{delivered}</div>
          <div className="sc-l">Delivered</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{logged}</div>
          <div className="sc-l">Logged only</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{failed}</div>
          <div className="sc-l">Failed</div>
        </div>
      </div>

      <div className="pill-bar">
        <a href={emailHref(undefined, 1)} className={`pill${!template ? ' on' : ''}`}>All</a>
        {templates.map((t) => (
          <a key={t} href={emailHref(t, 1)} className={`pill${template === t ? ' on' : ''}`}>
            {t.replace(/_/g, ' ')}
          </a>
        ))}
      </div>

      {emails.length === 0 ? (
        <div className="empty-state"><span className="ico">📮</span>No emails recorded yet.</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th><th>To</th><th>Subject</th><th>Template</th>
                <th>Provider</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.created_at)}</td>
                  <td>{e.to_email}</td>
                  <td style={{ maxWidth: 380 }}>{e.subject}</td>
                  <td><span className="badge badge-gray">{e.template}</span></td>
                  <td>{e.provider}</td>
                  <td>
                    <StatusBadge status={e.status} />
                    {e.error && (
                      <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{e.error}</div>
                    )}
                  </td>
                  <td><EmailPreview subject={e.subject} html={e.html ?? ''} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Email log pages">
          <a
            className={page <= 1 ? 'disabled' : ''}
            href={emailHref(template, page - 1)}
            aria-label="Previous email page"
            aria-disabled={page <= 1}
          >
            Prev
          </a>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            pageNumber === page ? (
              <span className="on" key={pageNumber} aria-current="page">{pageNumber}</span>
            ) : (
              <a key={pageNumber} href={emailHref(template, pageNumber)}>{pageNumber}</a>
            )
          ))}
          <a
            className={page >= totalPages ? 'disabled' : ''}
            href={emailHref(template, page + 1)}
            aria-label="Next email page"
            aria-disabled={page >= totalPages}
          >
            Next
          </a>
        </nav>
      )}
    </>
  );
}
