import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await destroySession();
  // Build the redirect from the current request origin. This keeps production
  // logout on bookingmodel.com even if a local NEXT_PUBLIC_SITE_URL was left
  // in the server environment.
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
