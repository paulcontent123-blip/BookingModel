import { NextResponse } from 'next/server';
import { resolveGeo } from '@/lib/guard';
import { assertApplicantCampaign } from '@/lib/services/public-requests';
import { applicantRequestSchema } from '@/lib/services/public-request-schemas';
import { startRequestEmailVerification } from '@/lib/services/request-email-verification';

export const runtime = 'nodejs';

/** POST /api/applicants — public "Apply as Creator" form (TechSpec §5). */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = applicantRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the form.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const data = parsed.data;

  const campaignCheck = await assertApplicantCampaign(data.campaign_id);
  if (!campaignCheck.ok) {
    return NextResponse.json({ error: campaignCheck.error }, { status: 400 });
  }

  const verification = await startRequestEmailVerification('applicant', data.email, {
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
      message: 'We sent a 6-digit verification code to your email. Your application will be saved after you confirm it.',
    },
    { status: 202 },
  );
}
