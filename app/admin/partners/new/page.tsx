import Link from 'next/link';
import { PartnerForm } from '@/components/admin/partner-form';
import { createPartnerAction } from '@/lib/services/partner-actions';

export const metadata = { title: 'New Partner' };

export default function NewPartnerPage() {
  return (
    <>
      <h1 className="pg-title">New partner</h1>
      <p className="pg-sub">
        Add a partner profile. Choose Published when it is ready to appear on{' '}
        <Link href="/partnership" target="_blank">/partnership</Link>.
      </p>

      <PartnerForm action={createPartnerAction} submitLabel="Create partner" />
    </>
  );
}
