import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { BrandAccountForm } from '@/components/brand-account-form';
import { getBrandById } from '@/lib/services/brand-profile';
import { updateBrandProfileAdminAction } from '@/lib/services/brand-actions';

export const metadata = { title: 'Edit Brand' };
export const dynamic = 'force-dynamic';

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await getBrandById(id);
  if (!brand) notFound();

  const user = await db.get('users', brand.user_id);
  return (
    <div className="brand-profile-layout">
      <Link href="/admin/brands" className="brand-profile-back">← All brands</Link>
      <h1 className="pg-title">Edit brand</h1>
      <p className="pg-sub">Update the business profile, contact details, avatar and account status.</p>
      <p className="brand-profile-account">
        Login account: {user?.email ?? brand.contact_email ?? '—'}
      </p>

      <BrandAccountForm
        brand={brand}
        accountEmail={user?.email ?? brand.contact_email ?? ''}
        adminMode
        submitLabel="Save brand"
        action={async (formData) => {
          'use server';
          return updateBrandProfileAdminAction(brand.id, formData);
        }}
      />
    </div>
  );
}
