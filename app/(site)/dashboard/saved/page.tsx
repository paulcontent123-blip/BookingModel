import Link from 'next/link';
import type { Metadata } from 'next';
import { requirePlanFeature } from '@/lib/auth';

export const metadata: Metadata = { title: 'Saved Creators' };

export default async function SavedCreatorsPage() {
  await requirePlanFeature('saved_creators');

  return (
    <div className="brand-dashboard-subpage">
      <h1>Saved Creators</h1>
      <div className="brand-dashboard-empty-card">
        <div className="brand-dashboard-empty-icon">♥</div>
        No saved creators yet.
        <small>Click ♡ on any creator to save them.</small>
        <Link href="/dashboard/creators" className="brand-dashboard-empty-link">Browse creators →</Link>
      </div>
    </div>
  );
}
