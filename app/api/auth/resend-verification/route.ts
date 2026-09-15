import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { issueVerificationCode, normalizeVerificationEmail } from '@/lib/services/email-verification';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email() });
const genericMessage = 'If an unverified account exists for this email, a new code has been sent.';

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const email = normalizeVerificationEmail(parsed.data.email);
  const user = await db.findOne('users', { email });
  if (!user || user.is_verified || user.role === 'admin') {
    return NextResponse.json({ ok: true, message: genericMessage });
  }

  const result = await issueVerificationCode(user);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'We could not send a new verification code.' },
      { status: result.retryAfterSeconds ? 429 : 502 },
    );
  }

  return NextResponse.json({ ok: true, message: 'A new verification code has been sent.' });
}
