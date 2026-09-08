import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveGeo } from '@/lib/guard';
import { createBookingRequest } from '@/lib/services/booking';

export const runtime = 'nodejs';

const schema = z.object({
  creatorId: z.string().nullish(),
  campaignId: z.string().nullish(),
  fullName: z.string().min(1).max(160),
  email: z.string().email(),
  phone: z.string().max(60).nullish(),
  company: z.string().max(160).nullish(),
  website: z.string().max(300).nullish(),
  preferredContact: z.string().max(40).nullish(),
  budget: z.string().max(80).nullish(),
  contentType: z.string().max(120).nullish(),
  quantity: z.coerce.number().int().min(1).max(500).nullish(),
  message: z.string().max(4000).nullish(),
});

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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please fill in your name and a valid email.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const input = parsed.data;

  const result = await createBookingRequest({
    creatorId: input.creatorId ?? null,
    campaignId: input.campaignId ?? null,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    company: input.company ?? null,
    website: input.website ?? null,
    preferredContact: input.preferredContact ?? 'email',
    budget: input.budget ?? null,
    contentType: input.contentType ?? null,
    quantity: input.quantity ?? null,
    message: input.message ?? null,
    country: geo.country,
    regionBlocked: !geo.canTransact,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(
    { ok: true, request_ref: result.request.request_ref },
    { status: 201 },
  );
}
