import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Settings' };

export default async function BrandSettingsPage() {
  const user = await requireUser();

  return (
    <div className="brand-dashboard-subpage">
      <h1>Settings</h1>
      <div className="brand-dashboard-settings-card">
        <label htmlFor="brand-company">Company name</label>
        <input id="brand-company" defaultValue={user.company_name ?? ''} />
        <label htmlFor="brand-email">Email</label>
        <input id="brand-email" defaultValue={user.email} readOnly />
        <button type="button">Save changes</button>
      </div>
    </div>
  );
}
