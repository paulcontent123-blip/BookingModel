import { NextResponse, type NextRequest } from 'next/server';
import { config as appConfig } from '@/lib/config';
import {
  GEO_OVERRIDE_COOKIE,
  GEO_OVERRIDE_HEADER,
  GEO_OVERRIDE_SOURCE_HEADER,
} from '@/lib/geo';

/**
 * Resolves the visitor's country once per request and forwards it to every
 * server component / route handler through `x-bm-country`.
 *
 * Order of precedence:
 *   1. optional GEO test query/cookie (validated again server-side)
 *   2. x-vercel-ip-country / cf-ipcountry      (free, no API key)
 *   3. proxy country headers when available
 *   4. nothing -> the route falls back to GEO_UNKNOWN_POLICY
 *
 * The IP-lookup fallback (ipinfo) runs in the route handlers, not here, to keep
 * the middleware on the edge fast.
 *
 * NOTE: this only *labels* the request. Enforcement lives in lib/guard.ts so a
 * spoofed header cannot buy anything — the same check runs again server-side.
 */

function resolveCountry(req: NextRequest): { country: string | null; source: string } {
  for (const provider of appConfig.geo.providers) {
    if (provider === 'vercel') {
      const c = req.headers.get('x-vercel-ip-country');
      if (c && c !== 'XX') return { country: c.toUpperCase(), source: 'vercel' };
    }
    if (provider === 'cloudflare') {
      const c = req.headers.get('cf-ipcountry');
      if (c && c !== 'XX') return { country: c.toUpperCase(), source: 'cloudflare' };
    }
  }

  const generic = req.headers.get('x-country-code') ?? req.headers.get('x-geo-country');
  if (generic && /^[A-Za-z]{2}$/.test(generic)) {
    return { country: generic.toUpperCase(), source: 'proxy-header' };
  }

  return { country: null, source: 'unknown' };
}

export function middleware(req: NextRequest) {
  const testParam = req.nextUrl.searchParams.get('geo');
  const resetTestCountry = testParam === 'reset' || testParam === 'clear';
  const cookieCountry = req.cookies.get(GEO_OVERRIDE_COOKIE)?.value ?? null;
  const testCountry = !resetTestCountry && testParam && /^[A-Za-z]{2}$/.test(testParam)
    ? testParam.toUpperCase()
    : !resetTestCountry && cookieCountry && /^[A-Za-z]{2}$/.test(cookieCountry)
      ? cookieCountry.toUpperCase()
      : null;

  const { country, source } = resolveCountry(req);

  const headers = new Headers(req.headers);
  // Strip anything a client might have injected before we set our own value.
  headers.delete(appConfig.geo.headerName);
  headers.delete(appConfig.geo.sourceHeaderName);
  headers.delete(GEO_OVERRIDE_HEADER);
  headers.delete(GEO_OVERRIDE_SOURCE_HEADER);
  if (country) headers.set(appConfig.geo.headerName, country);
  headers.set(appConfig.geo.sourceHeaderName, source);
  if (testCountry) {
    headers.set(GEO_OVERRIDE_HEADER, testCountry);
    headers.set(GEO_OVERRIDE_SOURCE_HEADER, testParam ? 'debug-param' : 'debug-cookie');
  }

  const res = NextResponse.next({ request: { headers } });

  // The server validates the admin setting before honoring this cookie. The
  // cookie only makes the selected test country survive navigation.
  if (testParam && /^[A-Za-z]{2}$/.test(testParam)) {
    res.cookies.set(GEO_OVERRIDE_COOKIE, testParam.toUpperCase(), {
      path: '/',
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
    });
  } else if (resetTestCountry) {
    res.cookies.delete(GEO_OVERRIDE_COOKIE);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
