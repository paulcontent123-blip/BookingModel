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

/** Dev-only country switcher so the gate can be demoed without a VPN. */
export function GeoDebugPanel() {
  const { geo, debug } = useGeo();
  if (!debug) return null;

  const countries = ['US', 'CA', 'VN', 'TH', 'SG', 'PH', 'ID', 'MY', 'GB', 'AU'];

  return (
    <div className="geo-debug" title="NEXT_PUBLIC_GEO_DEBUG=true — disable this in production">
      <span className={`dot ${geo.canTransact ? 'ok' : 'no'}`} />
      <span>GEO</span>
      <select
        value={geo.country ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          const url = new URL(window.location.href);
          url.searchParams.set('geo', v || 'reset');
          window.location.href = url.toString();
        }}
      >
        <option value="">unknown</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c} — {countryName(c)}
          </option>
        ))}
      </select>
      <span style={{ opacity: 0.55 }}>{geo.canTransact ? 'can pay' : 'blocked'}</span>
    </div>
  );
}
