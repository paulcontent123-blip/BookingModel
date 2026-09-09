'use client';

import { countryFlag, countryName } from '@/lib/geo';
import { useGeo } from './geo-provider';

/** Persistent notice for visitors who cannot check out (requirement #1). */
export function GeoBar() {
  const { geo, openRestricted } = useGeo();
  if (geo.canTransact) return null;

  return (
    <div className="geo-bar" role="status">
      <span className="geo-flag">{countryFlag(geo.country)}</span>
      <span>
        {geo.isUnknown ? (
          <>
            We could not confirm your location, so <strong>online checkout is disabled</strong>.
            Our team can still set up any booking for you.
          </>
        ) : (
          <>
            You are browsing from <strong>{countryName(geo.country)}</strong>. Rates and creator
            profiles are fully visible, but <strong>online checkout is US-only</strong> — our
            account manager handles bookings from your region personally.
          </>
        )}
      </span>
      <button className="geo-cta" onClick={() => openRestricted()}>
        Request a booking
      </button>
    </div>
  );
}

/** Optional GEO test switcher, controlled by Admin → Settings. */
export function GeoStatusPanel({ visible }: { visible: boolean }) {
  const { geo } = useGeo();
  if (!visible) return null;

  const countries = ['US', 'CA', 'VN', 'TH', 'SG', 'PH', 'ID', 'MY', 'GB', 'AU'];

  return (
    <div className="geo-debug" title="GEO test mode — choose a country to test the payment gate">
      <span className={`dot ${geo.canTransact ? 'ok' : 'no'}`} />
      <span>GEO</span>
      <select
        aria-label="Test GEO country"
        value={geo.country ?? ''}
        onChange={(event) => {
          const value = event.currentTarget.value;
          const url = new URL(window.location.href);
          url.searchParams.set('geo', value || 'reset');
          window.location.assign(url.toString());
        }}
      >
        <option value="">{countryFlag(null)} Unknown / auto-detect</option>
        {countries.map((code) => (
          <option key={code} value={code}>
            {countryFlag(code)} {code} — {countryName(code)}
          </option>
        ))}
      </select>
      <span style={{ opacity: 0.55 }}>{geo.canTransact ? 'can pay' : 'blocked'}</span>
    </div>
  );
}
