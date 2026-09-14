import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { ensureBrandProfile } from '@/lib/services/brand-profile';
import { BrandAccountForm } from '@/components/brand-account-form';

export const metadata: Metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

export default async function BrandAccountPage() {
  const user = await requireUser('/login?next=/dashboard/account');
  const brand = await ensureBrandProfile({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    company_name: user.company_name,
    country: null,
  });

  return (
    <div className="brand-dashboard-subpage brand-dashboard-wide brand-account-page">
      <div className="brand-dashboard-page-header">
        <div>
          <h1>Brand account</h1>
          <p>Manage your brand identity, contact details, social profiles and avatar.</p>
        </div>
      </div>
      <BrandAccountForm brand={brand} accountEmail={user.email} />
    </div>
  );
}
