import { NextResponse } from 'next/server';
import { resolveGeo } from '@/lib/guard';
import { bookingRequestSchema } from '@/lib/services/public-request-schemas';
import { startRequestEmailVerification } from '@/lib/services/request-email-verification';

export const runtime = 'nodejs';

/**
 * POST /api/booking-requests — requirement #2.
 *
 * Open to every region on purpose: this is the fallback for visitors who
 * cannot check out, and US visitors may also use it to ask for a managed
 * campaign. The row records the country so the team knows which it was.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please fill in your name and enter a real email address you can access.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const input = parsed.data;
  const verification = await startRequestEmailVerification('booking_request', input.email, {
    ...input,
    country: geo.country,
    regionBlocked: !geo.canTransact,
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
