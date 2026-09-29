import { NextResponse } from 'next/server';
import { destroyAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  await destroyAdminSession();
  // Keep the redirect relative to the browser's public origin. On Vietnix the
  // internal request URL can be 0.0.0.0:3000, which must never be exposed to
  // the browser after logout.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/admin' },
  });
}
