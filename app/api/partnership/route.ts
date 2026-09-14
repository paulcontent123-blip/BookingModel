import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveGeo } from '@/lib/guard';
import { adminPartnershipEmail, sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().min(1, 'Your name is required.').max(160),
  company: z.string().trim().max(160).optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().max(60).optional(),
  type: z.string().trim().min(1, 'Choose a partnership type.').max(80),
  budget: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1, 'Tell us about the partnership.').max(4000),
});

/** POST /api/partnership — public "Partnership & Collaboration" form. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please complete the form.' },
      { status: 400 },
    );
  }

  const geo = await resolveGeo();
  const data = parsed.data;

  const request = await db.insert('partnership_requests', {
    name: data.name ?? null,
    company: data.company ?? null,
    email: data.email.toLowerCase(),
    phone: data.phone ?? null,
    type: data.type ?? null,
    budget: data.budget ?? null,
    description: data.description ?? null,
    status: 'new',
    assigned_to: null,
    source: 'website',
    country: geo.country,
    created_at: new Date().toISOString(),
  });

  await sendEmail(adminPartnershipEmail(request), { type: 'partnership_request', id: request.id });

  return NextResponse.json({ ok: true, id: request.id }, { status: 201 });
}
