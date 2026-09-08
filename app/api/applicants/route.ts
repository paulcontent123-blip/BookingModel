import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveGeo } from '@/lib/guard';
import { adminNewApplicantEmail, applicantReceivedEmail, sendAll } from '@/lib/email';
import { normalizeHandle } from '@/lib/utils';

export const runtime = 'nodejs';

const schema = z.object({
  campaign_id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  handle: z.string().min(1).max(80),
  platform: z.string().min(1).max(40),
  channel_url: z.string().url('Enter a valid channel URL.'),
  niche: z.string().min(1).max(160),
  audience: z.string().max(40).optional(),
  er: z.string().max(20).optional(),
  rate: z.string().max(60).optional(),
  email: z.string().email(),
  phone: z.string().max(60).optional(),
  photo_url: z.string().max(600).optional(),
  video_url: z.string().max(600).optional(),
  notes: z.string().max(3000).optional(),
});

/** POST /api/applicants — public "Apply as Creator" form (TechSpec §5). */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the form.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const data = parsed.data;

  let campaignId: string | null = null;
  if (data.campaign_id) {
    const campaign = await db.get('campaigns', data.campaign_id);
    const spotsAvailable = campaign && campaign.spots_filled < campaign.spots_total;
    if (!campaign || campaign.status !== 'active' || !spotsAvailable) {
      return NextResponse.json(
        { error: 'This campaign is no longer accepting applications.' },
        { status: 400 },
      );
    }
    campaignId = campaign.id;
  }

  const applicant = await db.insert('applicants', {
    campaign_id: campaignId,
    name: data.name,
    handle: normalizeHandle(data.handle),
    platform: data.platform,
    channel_url: data.channel_url,
    niche: data.niche,
    audience: data.audience ?? null,
    er: data.er ?? null,
    rate: data.rate ?? null,
    email: data.email.toLowerCase(),
    phone: data.phone ?? null,
    photo_url: data.photo_url ?? null,
    video_url: data.video_url ?? null,
    notes: data.notes ?? null,
    status: 'pending',
    admin_notes: null,
    creator_id: null,
    country: geo.country,
    applied_at: new Date().toISOString(),
  });

  await sendAll([applicantReceivedEmail(applicant), adminNewApplicantEmail(applicant)], {
    type: 'applicant',
    id: applicant.id,
  });

  return NextResponse.json({ ok: true, id: applicant.id }, { status: 201 });
}
