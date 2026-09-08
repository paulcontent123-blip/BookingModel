import 'server-only';
import { headers } from 'next/headers';
import { config } from './config';
import { clientIp, evaluateCountry, lookupCountryByIp, type GeoInfo } from './geo';

/**
 * Server-side enforcement of the US-only booking rule.
 *
 * Every route that creates a booking or takes money calls `resolveGeo()` and
 * refuses when `canTransact` is false — the client-side modal is only there so
 * the user is not surprised. A forged `x-bm-country` header does not help: the
 * middleware strips inbound copies of that header before setting its own.
 */

export const GEO_ERROR_CODE = 'GEO_RESTRICTED';

export async function resolveGeo(): Promise<GeoInfo> {
  const h = await headers();

  const fromMiddleware = h.get(config.geo.headerName);
  const source = h.get(config.geo.sourceHeaderName) ?? 'unknown';

  if (fromMiddleware) {
    return { ...evaluateCountry(fromMiddleware), source };
  }

  // Middleware found nothing (self-hosted / no CDN) — try the IP lookup once.
  const ip = clientIp(h);
  const looked = await lookupCountryByIp(ip);
  if (looked.country) {
    return { ...evaluateCountry(looked.country), source: looked.source };
  }

  return { ...evaluateCountry(null), source: looked.source };
}

export interface GeoRejection {
  ok: false;
  status: 403;
  body: {
    error: string;
    code: typeof GEO_ERROR_CODE;
    country: string | null;
    allowed: string[];
    contact: {
      name: string;
      email: string;
      phone: string;
      whatsapp: string;
      hours: string;
    };
  };
}

/**
 * Returns `null` when the visitor may transact, or a ready-to-send 403 payload
 * telling the client to open the "leave your contact details" modal.
 */
export async function assertCanTransact(): Promise<GeoRejection | null> {
  const geo = await resolveGeo();
  if (geo.canTransact) return null;

  return {
    ok: false,
    status: 403,
    body: {
      error:
        'Online booking and payment are only available for brands based in ' +
        config.geo.allowedCountries.join(' / ') +
        '. Please leave your contact details and our account manager will complete the booking with you.',
      code: GEO_ERROR_CODE,
      country: geo.country,
      allowed: config.geo.allowedCountries,
      contact: {
        name: config.manager.name,
        email: config.manager.email,
        phone: config.manager.phone,
        whatsapp: config.manager.whatsapp,
        hours: config.manager.hours,
      },
    },
  };
}
