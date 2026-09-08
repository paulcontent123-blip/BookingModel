import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { countryFlag } from '@/lib/geo';
import { StatusBadge } from '@/components/status-badge';

export const metadata = { title: 'Contact Messages' };

export default async function MessagesPage() {
  const messages = await db.list('contact_messages', { orderBy: 'created_at', ascending: false });

  return (
    <>
      <h1 className="pg-title">Contact Messages</h1>
      <p className="pg-sub">Inquiries from the public contact form.</p>

      {messages.length === 0 ? (
        <div className="empty-state"><span className="ico">✉️</span>No messages yet.</div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-head"><div className="tbl-title">{messages.length} messages</div></div>
          <table>
            <thead>
              <tr>
                <th>From</th><th>Company</th><th>Type</th><th>Budget</th>
                <th>Message</th><th>Origin</th><th>Received</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}
                    </div>
                    <a href={`mailto:${m.email}`} style={{ fontSize: 11.5, color: 'var(--blue)' }}>
                      {m.email}
                    </a>
                  </td>
                  <td>{m.company ?? '—'}</td>
                  <td><span className="badge badge-blue">{m.inquiry_type ?? '—'}</span></td>
                  <td>{m.budget ?? '—'}</td>
                  <td style={{ maxWidth: 340, fontSize: 12.5 }}>{m.message ?? '—'}</td>
                  <td>{countryFlag(m.country)} {m.country ?? '—'}</td>
                  <td>{formatDateTime(m.created_at)}</td>
                  <td><StatusBadge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
