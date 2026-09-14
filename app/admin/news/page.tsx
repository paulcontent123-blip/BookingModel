import Link from 'next/link';
import { listAllNews } from '@/lib/services/content';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ActionButton, ActionSelect } from '@/components/admin/action-button';
import { deleteNewsPostAction, seedStarterContentAction, setNewsStatusAction } from '@/lib/services/content-actions';

export const metadata = { title: 'News Articles' };

const STATUSES = ['draft', 'published'] as const;

export default async function AdminNewsPage() {
  const posts = await listAllNews();
  const published = posts.filter((post) => post.status === 'published').length;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="pg-title">News &amp; articles</h1>
          <p className="pg-sub">
            Everything published here appears on the public{' '}
            <Link href="/news" target="_blank">News &amp; Showcase</Link> page and on the homepage.
          </p>
        </div>
        <Link href="/admin/news/new" className="btn btn-primary">＋ New article</Link>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-title">
            {posts.length} articles · {published} published
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state">
            <span className="ico">📰</span>
            No articles yet. <Link href="/admin/news/new">Write the first one →</Link>
            <div style={{ marginTop: 12 }}>
              <ActionButton
                className="btn btn-ghost btn-sm"
                label="…or load the starter articles"
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
                <th>Article</th>
                <th>Category</th>
                <th>Published</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      {post.emoji} {post.title}
                      {post.featured && (
                        <span style={{ fontSize: 11, color: 'var(--blue)', marginLeft: 6 }}>
                          ★ pinned
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>/news/{post.slug}</div>
                  </td>
                  <td>{post.category}</td>
                  <td>{post.published_at ? formatDateTime(post.published_at) : '—'}</td>
                  <td>
                    <div className="row gap-6">
                      <StatusBadge status={post.status} />
                      <ActionSelect
                        value={post.status}
                        options={[...STATUSES]}
                        action={async (next) => {
                          'use server';
                          return setNewsStatusAction(post.id, next);
                        }}
                      />
                    </div>
                  </td>
                  <td>{formatDateTime(post.updated_at)}</td>
                  <td>
                    <div className="row gap-6">
                      <Link href={`/admin/news/${post.id}`} className="btn btn-ghost btn-xs">
                        Edit
                      </Link>
                      <ActionButton
                        label="Delete"
                        pendingLabel="Deleting…"
                        confirm={`Delete "${post.title}"? This cannot be undone.`}
                        action={async () => {
                          'use server';
                          return deleteNewsPostAction(post.id);
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
