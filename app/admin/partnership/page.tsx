import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { countryFlag } from '@/lib/geo';
import { StatusBadge } from '@/components/status-badge';
import { ActionSelect } from '@/components/admin/action-button';
import { updatePartnershipStatusAction } from '@/lib/services/admin-actions';

export const metadata = { title: 'Partnership Requests' };

const STATUSES = ['new', 'in_discussion', 'converted', 'closed'] as const;

export default async function PartnershipPage() {
  const requests = await db.list('partnership_requests', {
    orderBy: 'created_at',
    ascending: false,
  });

  return (
    <>
      <h1 className="pg-title">Partnership Requests</h1>
      <p className="pg-sub">Submissions from the public Partnership &amp; Collaboration form.</p>

      {requests.length === 0 ? (
        <div className="empty-state"><span className="ico">🤝</span>No partnership requests yet.</div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-head"><div className="tbl-title">{requests.length} requests</div></div>
          <table>
            <thead>
              <tr>
                <th>Contact</th><th>Company</th><th>Type</th><th>Budget</th>
                <th>Message</th><th>Origin</th><th>Received</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.name ?? '—'}</div>
                    <a href={`mailto:${r.email}`} style={{ fontSize: 11.5, color: 'var(--blue)' }}>
                      {r.email}
                    </a>
                    {r.phone && <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{r.phone}</div>}
                  </td>
                  <td>{r.company ?? '—'}</td>
                  <td><span className="badge badge-blue">{r.type ?? '—'}</span></td>
                  <td>{r.budget ?? '—'}</td>
                  <td style={{ maxWidth: 320, fontSize: 12.5 }}>{r.description ?? '—'}</td>
                  <td>{countryFlag(r.country)} {r.country ?? '—'}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>
                    <div className="row gap-6">
                      <StatusBadge status={r.status} />
                      <ActionSelect
                        value={r.status}
                        options={[...STATUSES]}
                        action={async (next) => {
                          'use server';
                          return updatePartnershipStatusAction(
                            r.id,
                            next as (typeof STATUSES)[number],
                          );
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
