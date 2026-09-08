import { getSessionUser } from '@/lib/auth';
import { resolveGeo } from '@/lib/guard';
import { managerContact } from '@/lib/services/booking';
import { seedIfEmpty } from '@/lib/seed';
import { config } from '@/lib/config';
import { usingLocalStore } from '@/lib/db';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { GeoProvider } from '@/components/geo-provider';
import { GeoBar, GeoDebugPanel } from '@/components/geo-bar';
import { RestrictedRegionModal } from '@/components/restricted-region-modal';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // First run with the local store: load the 40-creator demo roster.
  if (usingLocalStore()) await seedIfEmpty();

  const [user, geo] = await Promise.all([getSessionUser(), resolveGeo()]);

  return (
    <GeoProvider geo={geo} manager={managerContact()} debug={config.geo.debug}>
      <SiteNav user={user} />
      <GeoBar />
      {children}
      <SiteFooter />
      <RestrictedRegionModal />
      <GeoDebugPanel />
    </GeoProvider>
  );
}
