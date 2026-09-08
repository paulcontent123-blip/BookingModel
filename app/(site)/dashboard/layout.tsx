import { requireUser } from '@/lib/auth';
import { BrandDashboardShell } from '@/components/brand-dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/login?next=/dashboard');

  return (
    <BrandDashboardShell user={user}>{children}</BrandDashboardShell>
  );
}
