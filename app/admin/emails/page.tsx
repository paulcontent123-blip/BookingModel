import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { EmailPreview } from '@/components/admin/email-preview';

export const metadata = { title: 'Email Log' };

/**
 * Every notification the platform produced — including the ones that were only
 * logged because RESEND_API_KEY is not set. This is how you verify requirements
 * #2 and #5 without a mail provider.
 */
export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const all = await db.list('email_log', { orderBy: 'created_at', ascending: false, limit: 500 });
  const emails = template ? all.filter((e) => e.template === template) : all;
  const templates = [...new Set(all.map((e) => e.template).filter(Boolean))] as string[];

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
        <div className="stat-card"><div className="sc-n">{all.length}</div><div className="sc-l">Messages</div></div>
        <div className="stat-card">
          <div className="sc-n">{all.filter((e) => e.status === 'sent').length}</div>
          <div className="sc-l">Delivered</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{all.filter((e) => e.status === 'logged').length}</div>
          <div className="sc-l">Logged only</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{all.filter((e) => e.status === 'failed').length}</div>
          <div className="sc-l">Failed</div>
        </div>
      </div>

      <div className="pill-bar">
        <a href="/admin/emails" className={`pill${!template ? ' on' : ''}`}>All</a>
        {templates.map((t) => (
          <a key={t} href={`/admin/emails?template=${t}`} className={`pill${template === t ? ' on' : ''}`}>
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
    </>
  );
}
