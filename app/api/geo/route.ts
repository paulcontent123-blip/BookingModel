import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { countryName } from '@/lib/geo';
import { resolveGeo } from '@/lib/guard';
import { managerContact } from '@/lib/services/booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/geo — what the server thinks of this visitor.
 * Useful for debugging the gate and for any client that needs it before the
 * page's own props arrive.
 */
export async function GET() {
  const geo = await resolveGeo();
  return NextResponse.json({
    country: geo.country,
    country_name: countryName(geo.country),
    source: geo.source,
    can_transact: geo.canTransact,
    is_restricted_region: geo.isRestrictedRegion,
    is_unknown: geo.isUnknown,
    allowed_countries: config.geo.allowedCountries,
    manager: managerContact(),
  });
}
