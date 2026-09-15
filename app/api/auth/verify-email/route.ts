import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, toSessionUser } from '@/lib/auth';
import { brandWelcomeEmail, sendEmail } from '@/lib/email';
import { verifyEmailCode } from '@/lib/services/email-verification';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code.'),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Enter your email and 6-digit code.' },
      { status: 400 },
    );
  }

  const result = await verifyEmailCode(parsed.data.email, parsed.data.code);
  if (!result.user || result.user.role === 'admin') {
    return NextResponse.json(
      { error: result.error ?? 'The verification code is invalid or expired.' },
      { status: 400 },
    );
  }

  await createSession(result.user);
  await sendEmail(
    brandWelcomeEmail(result.user.email, result.user.full_name),
    { type: 'user', id: result.user.id },
  );

  return NextResponse.json({ ok: true, user: toSessionUser(result.user) });
}
