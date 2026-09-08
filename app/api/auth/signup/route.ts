import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, registerUser, toSessionUser } from '@/lib/auth';
import { resolveGeo } from '@/lib/guard';
import { brandWelcomeEmail, sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters.'),
  full_name: z.string().min(1).max(160),
  company_name: z.string().max(160).optional(),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the form.' },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const { user, error } = await registerUser({ ...parsed.data, country: geo.country });
  if (!user) return NextResponse.json({ error }, { status: 409 });

  await createSession(user);
  await sendEmail(brandWelcomeEmail(user.email, user.full_name), { type: 'user', id: user.id });

  return NextResponse.json({ ok: true, user: toSessionUser(user) }, { status: 201 });
}
