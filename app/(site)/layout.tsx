import { getSessionUser } from '@/lib/auth';
import { resolveGeo } from '@/lib/guard';
import { managerContact } from '@/lib/services/booking';
import { isGeoStatusPanelVisible } from '@/lib/platform-settings';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { GeoProvider } from '@/components/geo-provider';
import { GeoBar, GeoStatusPanel } from '@/components/geo-bar';
import { RestrictedRegionModal } from '@/components/restricted-region-modal';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, geo, geoStatusPanelVisible] = await Promise.all([
    getSessionUser(),
    resolveGeo(),
    isGeoStatusPanelVisible(),
  ]);

  return (
    <GeoProvider geo={geo} manager={managerContact()}>
      <SiteNav user={user} />
      <GeoBar />
      {children}
      <SiteFooter />
      <RestrictedRegionModal />
      <GeoStatusPanel visible={geoStatusPanelVisible} />
    </GeoProvider>
  );
}
