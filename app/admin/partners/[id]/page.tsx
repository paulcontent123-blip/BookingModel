import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPartner } from '@/lib/services/partners';
import { PartnerForm } from '@/components/admin/partner-form';
import { ActionButton } from '@/components/admin/action-button';
import { deletePartnerAction, updatePartnerAction } from '@/lib/services/partner-actions';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Edit Partner' };

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) notFound();

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="pg-title">Edit partner</h1>
          <p className="pg-sub">
            Created {formatDateTime(partner.created_at)} · last updated {formatDateTime(partner.updated_at)}
          </p>
        </div>
        <ActionButton
          label="Delete partner"
          pendingLabel="Deleting…"
          className="btn btn-danger btn-sm"
          confirm={`Delete ${partner.name}? This cannot be undone.`}
          action={async () => {
            'use server';
            const result = await deletePartnerAction(partner.id);
            if (result.ok) redirect('/admin/partners');
            return result;
          }}
        />
      </div>

      <PartnerForm
        partner={partner}
        submitLabel="Save changes"
        action={async (formData) => {
          'use server';
          return updatePartnerAction(partner.id, formData);
        }}
      />

      <Link href="/admin/partners" className="brand-profile-back">← All partners</Link>
    </>
  );
}
