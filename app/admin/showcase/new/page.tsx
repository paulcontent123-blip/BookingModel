import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShowcaseForm } from '@/components/admin/showcase-form';
import { createShowcaseAction } from '@/lib/services/content-actions';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';

export const metadata = { title: 'New Case Study' };

export default function NewShowcasePage() {
  if (!BRAND_SHOWCASE_ENABLED) notFound();

  return (
    <>
      <h1 className="pg-title">New case study</h1>
      <p className="pg-sub">
        Save it as a draft while you gather the numbers. Publishing pushes it to{' '}
        <Link href="/showcase" target="_blank">/showcase</Link> right away.
      </p>

      <ShowcaseForm action={createShowcaseAction} submitLabel="Create case study" />
    </>
  );
}
