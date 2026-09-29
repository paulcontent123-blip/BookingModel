import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { persistVerifiedPublicRequest, type PersistedPublicRequest } from '@/lib/services/public-requests';
import { verifyRequestEmailCode } from '@/lib/services/request-email-verification';

export const runtime = 'nodejs';

const schema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code.'),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Enter the 6-digit verification code.' },
      { status: 400 },
    );
  }

  const verification = await verifyRequestEmailCode(
    parsed.data.verificationId,
    parsed.data.code,
  );
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }

  let result: PersistedPublicRequest;
  try {
    result = await persistVerifiedPublicRequest(
      verification.pending.request_type,
      verification.pending.payload,
    );
  } catch (err) {
    console.error('[request-email-verification] could not persist request:', err);
    try {
      await db.update('request_email_verifications', verification.pending.id, {
        verified_at: null,
      });
    } catch (resetErr) {
      console.error('[request-email-verification] could not reset pending record:', resetErr);
    }
    return NextResponse.json(
      { error: 'We could not save your request. Please try again.' },
      { status: 500 },
    );
  }
  if (!result.ok) {
    try {
      await db.update('request_email_verifications', verification.pending.id, {
        verified_at: null,
      });
    } catch (resetErr) {
      console.error('[request-email-verification] could not reset pending record:', resetErr);
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    await db.remove('request_email_verifications', verification.pending.id);
  } catch (err) {
    // The request is already persisted; the verified marker prevents replay.
    console.error('[request-email-verification] could not remove pending record:', err);
  }
  return NextResponse.json(
    {
      ok: true,
      id: result.id,
      request_ref: result.request_ref,
      message: 'Your email has been confirmed and your request was saved.',
    },
    { status: 201 },
  );
}
