import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { resolveGeo } from '@/lib/guard';
import { adminPartnershipEmail, sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
  email: z.string().email(),
  phone: z.string().max(60).optional(),
  type: z.string().max(80).optional(),
  budget: z.string().max(80).optional(),
  description: z.string().max(4000).optional(),
});

/** POST /api/partnership — public "Partnership & Collaboration" form. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
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
