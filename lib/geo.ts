import { config } from './config';

/**
 * Geo gating (requirements #1 and #2)
 * ---------------------------------------------------------------------------
 * BookingModel sells to the US market. Visitors from anywhere may browse the
 * marketplace, read creator profiles and see prices — but only visitors from
 * PAYMENT_ALLOWED_COUNTRIES (default US, CA) may create a booking and pay.
 *
 * Everyone else is routed to the "leave your details, our manager will contact
 * you" flow, which persists a booking_request and e-mails the team.
 *
 * The check is enforced on the SERVER for every booking/payment route — the UI
 * gate is only a courtesy. See `assertCanTransact` in lib/guard.ts.
 */

export interface GeoInfo {
  /** ISO-3166 alpha-2, uppercase. `null` when it could not be determined. */
  country: string | null;
  /** Where the value came from: vercel | cloudflare | ipinfo | debug | unknown */
  source: string;
  /** May this visitor create a booking and pay? */
  canTransact: boolean;
  /** Is this one of the explicitly restricted (SEA) markets? */
  isRestrictedRegion: boolean;
  /** True when we had to fall back to GEO_UNKNOWN_POLICY. */
  isUnknown: boolean;
}

/** Internal request markers used by the optional admin-controlled GEO test mode. */
export const GEO_OVERRIDE_HEADER = 'x-bm-geo-override';
export const GEO_OVERRIDE_SOURCE_HEADER = 'x-bm-geo-override-source';
export const GEO_OVERRIDE_COOKIE = 'bm_geo_override';

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', VN: 'Vietnam', TH: 'Thailand',
  ID: 'Indonesia', PH: 'Philippines', MY: 'Malaysia', SG: 'Singapore',
  KH: 'Cambodia', LA: 'Laos', MM: 'Myanmar', BN: 'Brunei', TL: 'Timor-Leste',
  GB: 'United Kingdom', AU: 'Australia', DE: 'Germany', FR: 'France',
  JP: 'Japan', KR: 'South Korea', IN: 'India', CN: 'China', MX: 'Mexico',
  BR: 'Brazil', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', SE: 'Sweden',
};

export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown location';
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)),
  );
}

/** Pure decision function — same logic on the server and in the client bundle. */
export function evaluateCountry(country: string | null): GeoInfo {
  const code = country ? country.toUpperCase() : null;

  if (!code || code === 'XX') {
    const allow = config.geo.unknownPolicy === 'allow';
    return {
      country: null,
      source: 'unknown',
      canTransact: allow,
      isRestrictedRegion: false,
      isUnknown: true,
    };
  }

  return {
    country: code,
    source: 'header',
    canTransact: config.geo.allowedCountries.includes(code),
    isRestrictedRegion: config.geo.restrictedCountries.includes(code),
    isUnknown: false,
  };
}

/**
 * Reads the country the middleware resolved. Works in server components,
 * route handlers and server actions.
 */
export async function getGeo(): Promise<GeoInfo> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const country = h.get(config.geo.headerName);
  const source = h.get(config.geo.sourceHeaderName) ?? 'unknown';
  const info = evaluateCountry(country);
  return { ...info, source: info.isUnknown ? source : source || info.source };
}

/** Extracts the country from raw request headers (used by middleware). */
export function countryFromHeaders(h: Headers): { country: string | null; source: string } {
  for (const provider of config.geo.providers) {
    if (provider === 'vercel') {
      const c = h.get('x-vercel-ip-country');
      if (c) return { country: c.toUpperCase(), source: 'vercel' };
    }
    if (provider === 'cloudflare') {
      const c = h.get('cf-ipcountry');
      if (c && c !== 'XX') return { country: c.toUpperCase(), source: 'cloudflare' };
    }
  }
  // Some proxies forward this one.
  const generic = h.get('x-country-code') ?? h.get('x-geo-country');
  if (generic) return { country: generic.toUpperCase(), source: 'proxy-header' };
  return { country: null, source: 'unknown' };
}

/** Client IP from the usual proxy headers. */
export function clientIp(h: Headers): string | null {
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? null;
}

const LOCAL_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/;

/**
 * Optional IP -> country lookup, used only when the platform gives no header.
 * Results are cached by Next's fetch cache for a day.
 */
export async function lookupCountryByIp(ip: string | null): Promise<{ country: string | null; source: string }> {
  if (!ip || LOCAL_IP.test(ip)) return { country: null, source: 'local-ip' };

  const token = config.geo.ipinfoToken;
  const useIpinfo = config.geo.providers.includes('ipinfo') && token && !/placeholder/i.test(token);
  // Self-hosted deployments such as cPanel do not provide Vercel/Cloudflare
  // country headers. If IPinfo is listed but has no real token, fall back to
  // the tokenless provider so the visitor still gets an automatic country.
  const useIpapi = config.geo.providers.includes('ipapi') ||
    (config.geo.providers.includes('ipinfo') && !useIpinfo);

  try {
    if (useIpinfo) {
      const res = await fetch(`https://ipinfo.io/${ip}/json?token=${token}`, {
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const data = (await res.json()) as { country?: string };
        if (data.country) return { country: data.country.toUpperCase(), source: 'ipinfo' };
      }
    } else if (useIpapi) {
      const res = await fetch(`https://ipapi.co/${ip}/country/`, { next: { revalidate: 86400 } });
      if (res.ok) {
        const code = (await res.text()).trim();
        if (/^[A-Z]{2}$/i.test(code)) return { country: code.toUpperCase(), source: 'ipapi' };
      }
    }
  } catch (err) {
    console.warn('[geo] IP lookup failed:', err);
  }

  return { country: null, source: 'lookup-failed' };
}

/** Human-readable reason shown in the restricted-region modal. */
export function restrictionMessage(geo: GeoInfo): string {
  if (geo.isRestrictedRegion) {
    return `Online checkout is not available in ${countryName(geo.country)} yet. Leave your details and our account manager will set the booking up with you directly.`;
  }
  if (geo.isUnknown) {
    return 'We could not verify your location, so online checkout is disabled. Leave your details and our team will complete the booking with you.';
  }
  return `Self-serve checkout currently covers ${config.geo.allowedCountries
    .map(countryName)
    .join(' and ')} only. Leave your details and our account manager will handle the booking for you.`;
}
