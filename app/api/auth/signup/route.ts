import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { resolveGeo } from '@/lib/guard';
import { issueVerificationCode, normalizeVerificationEmail } from '@/lib/services/email-verification';

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
  const email = normalizeVerificationEmail(parsed.data.email);
  const existing = await db.findOne('users', { email });
  if (existing) {
    if (!existing.is_verified) {
      return NextResponse.json(
        {
          error: 'This email is awaiting verification. Enter the code we sent or request a new one.',
          requiresVerification: true,
          email: existing.email,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'An account with this email already exists.' },
      { status: 409 },
    );
  }

  const { user, error } = await registerUser({ ...parsed.data, email, country: geo.country });
  if (!user) return NextResponse.json({ error }, { status: 409 });

  const verification = await issueVerificationCode(user);
  if (!verification.ok) {
    return NextResponse.json(
      {
        error: verification.error ?? 'We could not send the verification email. Please try again.',
        requiresVerification: true,
        email: user.email,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      requiresVerification: true,
      email: user.email,
      message: 'We sent a 6-digit verification code to your email.',
    },
    { status: 201 },
  );
}
