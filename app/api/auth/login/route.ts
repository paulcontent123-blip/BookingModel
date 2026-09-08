import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, createSession, toSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  const raw = contentType.includes('application/json')
    ? await req.json().catch(() => null)
    : Object.fromEntries(await req.formData());

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user || user.role === 'admin') {
    // Same message for unknown email and wrong password — no account enumeration.
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  await createSession(user);
  return NextResponse.json({ ok: true, user: toSessionUser(user) });
}
