import { NextResponse } from 'next/server';
import { resolveGeo } from '@/lib/guard';
import { partnershipRequestSchema } from '@/lib/services/public-request-schemas';
import { startRequestEmailVerification } from '@/lib/services/request-email-verification';

export const runtime = 'nodejs';

/** POST /api/partnership — public "Partnership & Collaboration" form. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = partnershipRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please complete the form.' },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const data = parsed.data;
  const verification = await startRequestEmailVerification('partnership', data.email, {
    ...data,
    country: geo.country,
  });
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error },
      { status: verification.retryAfterSeconds ? 429 : verification.invalidEmail ? 400 : 502 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      verificationRequired: true,
      verificationId: verification.verificationId,
      email: verification.email,
      message: 'We sent a 6-digit verification code to your email. Your request will be saved after you confirm it.',
    },
    { status: 202 },
  );
}
