import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getShowcaseCase } from '@/lib/services/content';
import { formatDateTime } from '@/lib/utils';
import { ShowcaseForm } from '@/components/admin/showcase-form';
import { ActionButton } from '@/components/admin/action-button';
import { deleteShowcaseAction, updateShowcaseAction } from '@/lib/services/content-actions';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

export const metadata = { title: 'Edit Case Study' };

export default async function EditShowcasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!BRAND_SHOWCASE_ENABLED) notFound();

  const { id } = await params;
  const item = await getShowcaseCase(id);
  if (!item) notFound();

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="pg-title">Edit case study</h1>
          <p className="pg-sub">
            Created {formatDateTime(item.created_at)} · last updated {formatDateTime(item.updated_at)}
            {item.status === 'published' && (
              <>
                {' '}·{' '}
                <Link href={`/showcase/${item.slug}`} target="_blank">View on site ↗</Link>
              </>
            )}
          </p>
        </div>
        <ActionButton
          label="Delete case study"
          pendingLabel="Deleting…"
          confirm={`Delete "${item.title}"? This cannot be undone.`}
          action={async () => {
            'use server';
            const result = await deleteShowcaseAction(item.id);
            if (result.ok) redirect('/admin/showcase');
            return result;
          }}
        />
      </div>

      <ShowcaseForm
        item={item}
        submitLabel="Save changes"
        action={async (formData) => {
          'use server';
          return updateShowcaseAction(item.id, formData);
        }}
      />
    </>
  );
}
