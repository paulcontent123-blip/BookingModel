import Link from 'next/link';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { countryFlag, countryName } from '@/lib/geo';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionSelect } from '@/components/admin/action-button';
import { updateBookingRequestAction } from '@/lib/services/admin-actions';
import type { BookingRequestStatus } from '@/lib/types';

export const metadata = { title: 'Regional Booking Requests' };

const STATUSES: BookingRequestStatus[] = ['new', 'contacted', 'quoted', 'converted', 'closed'];

/**
 * Requirement #2 — the queue of visitors who could not check out because of the
 * regional payment restriction and left their details instead.
 */
export default async function BookingRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await db.list('booking_requests', { orderBy: 'created_at', ascending: false });
  const requests = status ? all.filter((r) => r.status === status) : all;

  const byCountry = new Map<string, number>();
  for (const r of all) {
    const key = r.country ?? 'Unknown';
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
  }

  return (
    <>
      <h1 className="pg-title">Regional Booking Requests</h1>
      <p className="pg-sub">
        Leads captured when a visitor outside {config.geo.allowedCountries.join(' / ')} tried to
        book. Each one was emailed to {config.email.salesEmail} and acknowledged to the sender.
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="sc-n">{all.filter((r) => r.status === 'new').length}</div>
          <div className="sc-l">Awaiting first contact</div>
          <div className="sc-d amber">Respond within 1 business day</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{all.filter((r) => r.status === 'converted').length}</div>
          <div className="sc-l">Converted to bookings</div>
        </div>
        <div className="stat-card">
          <div className="sc-n">{all.length}</div>
          <div className="sc-l">Total requests</div>
        </div>
        <div className="stat-card">
          <div className="sc-n" style={{ fontSize: 15, lineHeight: 1.5 }}>
            {[...byCountry.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([c, n]) => `${countryFlag(c)} ${c} ${n}`)
              .join('  ') || '—'}
          </div>
          <div className="sc-l">Top origins</div>
        </div>
      </div>

      <div className="pill-bar">
        <Link href="/admin/booking-requests" className={`pill${!status ? ' on' : ''}`}>
          All ({all.length})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/booking-requests?status=${s}`}
            className={`pill${status === s ? ' on' : ''}`}
          >
            {s} ({all.filter((r) => r.status === s).length})
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <span className="ico">🌏</span>
          No regional booking requests yet.
        </div>
      ) : (
        requests.map((r) => (
          <div className="card" style={{ marginBottom: 12 }} key={r.id}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'monospace', color: 'var(--blue)', fontWeight: 700 }}>
                  {r.request_ref}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                  {r.full_name}
                  {r.company && <span style={{ fontWeight: 500, color: 'var(--muted)' }}> — {r.company}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                  {countryFlag(r.country)} {countryName(r.country)} ·{' '}
                  {r.region_blocked ? 'blocked from checkout' : 'checkout was available'} ·{' '}
                  {formatDateTime(r.created_at)}
                </div>
              </div>
              <div className="row gap-8">
                <StatusBadge status={r.status} />
                <ActionSelect
                  value={r.status}
                  options={STATUSES}
                  action={async (next) => {
                    'use server';
                    return updateBookingRequestAction(r.id, next as BookingRequestStatus);
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 10,
                marginTop: 14,
                fontSize: 13,
              }}
            >
              <Field label="Email" value={<a href={`mailto:${r.email}`} style={{ color: 'var(--blue)' }}>{r.email}</a>} />
              <Field
                label="Phone"
                value={r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--blue)' }}>{r.phone}</a> : '—'}
              />
              <Field label="Preferred contact" value={r.preferred_contact ?? '—'} />
              <Field label="Budget" value={r.budget ?? '—'} />
              <Field
                label="Creator requested"
                value={
                  r.creator_id ? (
                    <Link href={`/admin/creators/${r.creator_id}`} style={{ color: 'var(--blue)' }}>
                      {r.creator_name}
                    </Link>
                  ) : (r.creator_name ?? '—')
                }
              />
              <Field
                label="Content"
                value={`${r.quantity ? `${r.quantity}× ` : ''}${r.content_type ?? '—'}`}
              />
              <Field
                label="Website"
                value={
                  r.website ? (
                    <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                      {r.website}
                    </a>
                  ) : '—'
                }
              />
            </div>

            {r.message && (
              <p
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  borderLeft: '3px solid var(--blue)',
                  borderRadius: 5,
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {r.message}
              </p>
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <a
                className="btn btn-primary btn-sm"
                href={`mailto:${r.email}?subject=${encodeURIComponent(`BookingModel — your request ${r.request_ref}`)}&body=${encodeURIComponent(`Hi ${r.full_name.split(' ')[0]},\n\nThank you for your booking request${r.creator_name ? ` for ${r.creator_name}` : ''}. I can set this up for you directly.\n\n`)}`}
              >
                Reply by email
              </a>
              {r.phone && <a className="btn btn-ghost btn-sm" href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>Call</a>}
              {r.phone && (
                <a
                  className="btn btn-ghost btn-sm"
                  href={`https://wa.me/${r.phone.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              )}
              {r.creator_id && (
                <Link className="btn btn-ghost btn-sm" href={`/book/${r.creator_id}`}>
                  Open checkout on their behalf
                </Link>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted2)' }}>
        {label}
      </div>
      <div style={{ marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
