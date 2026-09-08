import { NextResponse } from 'next/server';
import { db, usingLocalStore } from '@/lib/db';
import { getAdminSessionUser } from '@/lib/auth';
import { runSeed } from '@/lib/seed';
import { config } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * POST /api/admin/seed — load the demo dataset (40 creators, campaigns, demo
 * accounts) into whichever database is active.
 *
 * Needed after connecting Supabase, because the automatic first-run seed only
 * fires for the local JSON store. Refuses to run when creators already exist so
 * a stray call cannot duplicate the roster.
 */
export async function POST(req: Request) {
  const user = await getAdminSessionUser();

  // Bootstrap case: a fresh Supabase database has no admin to sign in with, so
  // allow the very first seed when the users table is still empty.
  const userCount = await db.count('users');
  const isBootstrap = userCount === 0;

  if (!isBootstrap && (!user || user.role !== 'admin')) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const existing = await db.count('creators');
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';

  if (existing > 0 && !force) {
    return NextResponse.json(
      {
        error: `Database already holds ${existing} creators. Pass ?force=true to seed anyway (this will create duplicates).`,
        creators: existing,
      },
      { status: 409 },
    );
  }

  const result = await runSeed();

  return NextResponse.json({
    ok: true,
    storage: usingLocalStore() ? 'local JSON store' : 'Supabase',
    ...result,
    accounts: [
      { role: 'admin', email: config.seed.adminEmail },
      { role: 'brand (pro)', email: config.seed.brandEmail },
      { role: 'brand (standard)', email: 'standard@demo.com' },
      { role: 'brand (free)', email: 'free@demo.com' },
    ],
    note: isBootstrap
      ? 'Seeded without authentication because the users table was empty. Sign in with the admin account now.'
      : undefined,
  });
}
