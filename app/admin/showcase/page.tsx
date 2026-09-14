import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listAllShowcase } from '@/lib/services/content';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import { deleteShowcaseAction, seedStarterContentAction, setShowcaseStatusAction } from '@/lib/services/content-actions';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

export const metadata = { title: 'Brand Showcase' };

const STATUSES = ['draft', 'published'] as const;

export default async function AdminShowcasePage() {
  if (!BRAND_SHOWCASE_ENABLED) notFound();

  const items = await listAllShowcase();
  const published = items.filter((item) => item.status === 'published').length;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="pg-title">Brand showcase</h1>
          <p className="pg-sub">
            Delivered campaigns with their numbers. Published cases appear on{' '}
            <Link href="/showcase" target="_blank">/showcase</Link> and in the showcase grid on
            the News page.
          </p>
        </div>
        <Link href="/admin/showcase/new" className="btn btn-primary">＋ New case study</Link>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-title">
            {items.length} case studies · {published} published
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <span className="ico">🏆</span>
            No case studies yet. <Link href="/admin/showcase/new">Add the first one →</Link>
            <div style={{ marginTop: 12 }}>
              <ActionButton
                className="btn btn-ghost btn-sm"
                label="…or load the starter case studies"
                pendingLabel="Loading…"
                action={async () => {
                  'use server';
                  return seedStarterContentAction();
                }}
              />
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Brand</th>
                <th>Stat line</th>
                <th>Order</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{item.emoji} {item.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                      /showcase/{item.slug}
                    </div>
                  </td>
                  <td>{item.brand}</td>
                  <td>{item.meta ?? '—'}</td>
                  <td>{item.sort_order}</td>
                  <td>
                    <div className="row gap-6">
                      <StatusBadge status={item.status} />
                      <ActionSelect
                        value={item.status}
                        options={[...STATUSES]}
                        action={async (next) => {
                          'use server';
                          return setShowcaseStatusAction(item.id, next);
                        }}
                      />
                    </div>
                  </td>
                  <td>{formatDateTime(item.updated_at)}</td>
                  <td>
                    <div className="row gap-6">
                      <Link href={`/admin/showcase/${item.id}`} className="btn btn-ghost btn-xs">
                        Edit
                      </Link>
                      <ActionButton
                        label="Delete"
                        pendingLabel="Deleting…"
                        confirm={`Delete "${item.title}"? This cannot be undone.`}
                        action={async () => {
                          'use server';
                          return deleteShowcaseAction(item.id);
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
