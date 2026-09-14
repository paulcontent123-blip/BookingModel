import Link from 'next/link';
import { brandInitials } from '@/lib/brand-profile';
import { ensureBrandProfilesForExistingUsers, listAllBrands } from '@/lib/services/brand-profile';

export const metadata = { title: 'All Brands' };
export const dynamic = 'force-dynamic';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function statusClass(status: string): string {
  if (status === 'active') return 'badge-green';
  if (status === 'pending') return 'badge-amber';
  return 'badge-gray';
}

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  // This also makes older installs visible immediately after the migration:
  // every existing brand/agency user gets one profile row.
  await ensureBrandProfilesForExistingUsers();
  const allBrands = await listAllBrands();
  const params = await searchParams;
  const query = (params.q ?? '').trim().toLowerCase();
  const brands = allBrands.filter((brand) => {
    if (params.status && brand.status !== params.status) return false;
    if (!query) return true;
    return [
      brand.brand_name,
      brand.legal_name,
      brand.website,
      brand.contact_name,
      brand.contact_email,
      brand.city,
      brand.state,
      brand.country,
      brand.industry,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(query));
  });

  return (
    <>
      <h1 className="pg-title">Brand database</h1>
      <p className="pg-sub">
        Manage brand accounts and business profiles. {allBrands.length} total ·{' '}
        {allBrands.filter((brand) => brand.status === 'active').length} active ·{' '}
        {allBrands.filter((brand) => brand.status === 'pending').length} pending.{' '}
        Showing {brands.length} matching brands.
      </p>

      <form className="filter-bar" method="get">
        <input
          name="q"
          placeholder="Search brand, contact, email, industry…"
          defaultValue={params.q ?? ''}
        />
        <select name="status" defaultValue={params.status ?? ''}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
        <Link href="/admin/brands" className="btn btn-ghost btn-sm">Reset</Link>
      </form>

      {brands.length === 0 ? (
        <div className="card empty-state">
          <span className="ico">🔍</span>
          No matching brands.
        </div>
      ) : (
        <div className="tbl-wrap brand-table-wrap">
          <div className="tbl-head">
            <div className="tbl-title">{brands.length} brand{brands.length === 1 ? '' : 's'}</div>
          </div>
          <table className="brand-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Industry</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => {
                const location = [brand.city, brand.state, brand.country].filter(Boolean).join(', ') || '—';
                return (
                  <tr key={brand.id}>
                    <td>
                      <div className="brand-table-brand">
                        <div className="brand-table-avatar">
                          {brand.avatar_url ? <img src={brand.avatar_url} alt="" /> : brandInitials(brand.brand_name)}
                        </div>
                        <div>
                          <strong>{brand.brand_name}</strong>
                          <small>{brand.legal_name ?? brand.website ?? 'Brand profile'}</small>
                        </div>
                      </div>
                    </td>
                    <td className="brand-table-meta">{brand.industry ?? '—'}</td>
                    <td className="brand-table-meta">{location}</td>
                    <td className="brand-table-meta">
                      <div>{brand.contact_name ?? '—'}</div>
                      {brand.contact_email && <a href={`mailto:${brand.contact_email}`}>{brand.contact_email}</a>}
                    </td>
                    <td><span className={`badge ${statusClass(brand.status)}`}>{brand.status}</span></td>
                    <td className="brand-table-meta">{formatDate(brand.created_at)}</td>
                    <td>
                      <div className="brand-table-actions">
                        <Link href={`/admin/brands/${brand.id}`} className="btn btn-ghost btn-xs">Edit</Link>
                        {brand.website && (
                          <a href={brand.website} target="_blank" rel="noreferrer" className="brand-table-link">↗</a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
