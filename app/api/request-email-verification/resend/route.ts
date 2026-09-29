import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resendRequestEmailVerification } from '@/lib/services/request-email-verification';

export const runtime = 'nodejs';

const schema = z.object({ verificationId: z.string().uuid() });

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'This verification request is invalid.' }, { status: 400 });
  }

  const result = await resendRequestEmailVerification(parsed.data.verificationId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.retryAfterSeconds ? 429 : 400 },
    );
  }

  return NextResponse.json({ ok: true, email: result.email, message: 'A new verification code has been sent.' });
}
