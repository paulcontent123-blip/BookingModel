import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, createAdminSession, toSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Internal-only login. Brand accounts are never accepted by this endpoint. */
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  const raw = contentType.includes('application/json')
    ? await req.json().catch(() => null)
    : Object.fromEntries(await req.formData());

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid admin email and password.' }, { status: 400 });
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user || user.role !== 'admin') {
    // Keep the response generic so this endpoint does not reveal account roles.
    return NextResponse.json({ error: 'Incorrect admin credentials.' }, { status: 401 });
  }

  await createAdminSession(user);
  return NextResponse.json({ ok: true, user: toSessionUser(user) });
}
