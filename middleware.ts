import { NextResponse, type NextRequest } from 'next/server';
import { config as appConfig } from '@/lib/config';

/**
 * Resolves the visitor's country once per request and forwards it to every
 * server component / route handler through `x-bm-country`.
 *
 * Order of precedence:
 *   1. ?geo=VN or the bm_geo_override cookie   (only when NEXT_PUBLIC_GEO_DEBUG=true)
 *   2. x-vercel-ip-country / cf-ipcountry      (free, no API key)
 *   3. nothing -> the route falls back to GEO_UNKNOWN_POLICY
 *
 * The IP-lookup fallback (ipinfo) runs in the route handlers, not here, to keep
 * the middleware on the edge fast.
 *
 * NOTE: this only *labels* the request. Enforcement lives in lib/guard.ts so a
 * spoofed header cannot buy anything — the same check runs again server-side.
 */

const COOKIE = 'bm_geo_override';

function resolveCountry(req: NextRequest): { country: string | null; source: string } {
  if (appConfig.geo.debug) {
    const param = req.nextUrl.searchParams.get('geo');
    if (param && /^[A-Za-z]{2}$/.test(param)) {
      return { country: param.toUpperCase(), source: 'debug-param' };
    }
    const cookie = req.cookies.get(COOKIE)?.value;
    if (cookie && /^[A-Za-z]{2}$/.test(cookie)) {
      return { country: cookie.toUpperCase(), source: 'debug-cookie' };
    }
  }

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
  const { country, source } = resolveCountry(req);

  const headers = new Headers(req.headers);
  // Strip anything a client might have injected before we set our own value.
  headers.delete(appConfig.geo.headerName);
  headers.delete(appConfig.geo.sourceHeaderName);
  if (country) headers.set(appConfig.geo.headerName, country);
  headers.set(appConfig.geo.sourceHeaderName, source);

  const res = NextResponse.next({ request: { headers } });

  // Persist a debug override so it survives client-side navigation.
  if (appConfig.geo.debug) {
    const param = req.nextUrl.searchParams.get('geo');
    if (param && /^[A-Za-z]{2}$/.test(param)) {
      res.cookies.set(COOKIE, param.toUpperCase(), {
        path: '/',
        maxAge: 60 * 60 * 8,
        sameSite: 'lax',
      });
    } else if (param === 'reset' || param === 'clear') {
      res.cookies.delete(COOKIE);
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
