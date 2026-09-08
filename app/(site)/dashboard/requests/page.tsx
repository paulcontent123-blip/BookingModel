import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'My Requests' };

export default async function RequestsPage() {
  const user = await requireUser();
  const all = await db.list('booking_requests', { orderBy: 'created_at', ascending: false });
  const requests = all.filter((r) => r.email === user.email);

  return (
    <div className="bm-admin" style={{ marginTop: 22 }}>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        Booking requests are created when online checkout is unavailable in your region. Our
        account manager — {config.manager.name}, {config.manager.email} — completes the booking
        with you directly.
      </div>

      {requests.length === 0 ? (
        <div className="empty-state"><span className="ico">✉️</span>No booking requests on this account.</div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-head"><div className="tbl-title">Requests ({requests.length})</div></div>
          <table>
            <thead>
              <tr>
                <th>Reference</th><th>Creator</th><th>Content</th>
                <th>Budget</th><th>Submitted</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ color: 'var(--blue)', fontWeight: 700 }}>{r.request_ref}</td>
                  <td>{r.creator_name ?? '—'}</td>
                  <td>{r.quantity ? `${r.quantity}× ` : ''}{r.content_type ?? '—'}</td>
                  <td>{r.budget ?? '—'}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
