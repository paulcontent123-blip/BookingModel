import Link from 'next/link';
import { listAllPartners } from '@/lib/services/partners';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import {
  deletePartnerAction,
  setPartnerStatusAction,
} from '@/lib/services/partner-actions';

export const metadata = { title: 'Partners' };

const STATUSES = ['draft', 'published'] as const;

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const all = await listAllPartners();
  const query = (params.q ?? '').trim().toLowerCase();
  const partners = all.filter((partner) => {
    if (params.status && partner.status !== params.status) return false;
    if (!query) return true;
    return [partner.name, partner.category, partner.website_url, partner.description]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(query));
  });
  const published = all.filter((partner) => partner.status === 'published').length;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="pg-title">Partners</h1>
          <p className="pg-sub">
            Manage the partner profiles shown on the public Partnership page. {all.length} total ·{' '}
            {published} published · {all.length - published} drafts.
          </p>
        </div>
        <Link href="/admin/partners/new" className="btn btn-primary">＋ New partner</Link>
      </div>

      <form className="filter-bar" method="get">
        <input
          name="q"
          placeholder="Search name, category, website…"
          defaultValue={params.q ?? ''}
        />
        <select name="status" defaultValue={params.status ?? ''}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button className="btn btn-primary btn-sm" type="submit">Filter</button>
        <Link href="/admin/partners" className="btn btn-ghost btn-sm">Reset</Link>
      </form>

      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-title">{partners.length} matching partner{partners.length === 1 ? '' : 's'}</div>
        </div>

        {partners.length === 0 ? (
          <div className="empty-state">
            <span className="ico">🤝</span>
            {all.length === 0 ? (
              <>No partners yet. <Link href="/admin/partners/new">Add the first partner →</Link></>
            ) : (
              'No partners match the current filters.'
            )}
          </div>
        ) : (
          <table className="partners-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Category</th>
                <th>Website</th>
                <th>Order</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id}>
                  <td>
                    <div className="partner-table-brand">
                      <div className="partner-table-logo">
                        {partner.logo_url ? (
                          <img src={partner.logo_url} alt="" />
                        ) : (
                          <span>{partner.icon ?? partner.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <strong>{partner.name}</strong>
                        {partner.description && <small>{partner.description}</small>}
                      </div>
                    </div>
                  </td>
                  <td>{partner.category ?? '—'}</td>
                  <td>
                    {partner.website_url ? (
                      <a href={partner.website_url} target="_blank" rel="noreferrer" className="brand-table-link">
                        Visit ↗
                      </a>
                    ) : '—'}
                  </td>
                  <td>{partner.sort_order}</td>
                  <td>
                    <div className="row gap-6">
                      <StatusBadge status={partner.status} />
                      <ActionSelect
                        value={partner.status}
                        options={[...STATUSES]}
                        action={async (next) => {
                          'use server';
                          return setPartnerStatusAction(partner.id, next);
                        }}
                      />
                    </div>
                  </td>
                  <td>{formatDateTime(partner.updated_at)}</td>
                  <td>
                    <div className="row gap-6">
                      <Link href={`/admin/partners/${partner.id}`} className="btn btn-ghost btn-xs">
                        Edit
                      </Link>
                      <ActionButton
                        label="Delete"
                        pendingLabel="Deleting…"
                        className="btn btn-danger btn-xs"
                        confirm={`Delete ${partner.name}? This cannot be undone.`}
                        action={async () => {
                          'use server';
                          return deletePartnerAction(partner.id);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
