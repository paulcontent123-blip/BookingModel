import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getNewsPost } from '@/lib/services/content';
import { formatDateTime } from '@/lib/utils';
import { NewsForm } from '@/components/admin/news-form';
import { ActionButton } from '@/components/admin/action-button';
import { deleteNewsPostAction, updateNewsPostAction } from '@/lib/services/content-actions';

export const metadata = { title: 'Edit Article' };

export default async function EditNewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getNewsPost(id);
  if (!post) notFound();

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="pg-title">Edit article</h1>
          <p className="pg-sub">
            Created {formatDateTime(post.created_at)} · last updated {formatDateTime(post.updated_at)}
            {post.status === 'published' && (
              <>
                {' '}·{' '}
                <Link href={`/news/${post.slug}`} target="_blank">View on site ↗</Link>
              </>
            )}
          </p>
        </div>
        <ActionButton
          label="Delete article"
          pendingLabel="Deleting…"
          confirm={`Delete "${post.title}"? This cannot be undone.`}
          action={async () => {
            'use server';
            const result = await deleteNewsPostAction(post.id);
            if (result.ok) redirect('/admin/news');
            return result;
          }}
        />
      </div>

      <NewsForm
        post={post}
        submitLabel="Save changes"
        action={async (formData) => {
          'use server';
          return updateNewsPostAction(post.id, formData);
        }}
      />
    </>
  );
}
