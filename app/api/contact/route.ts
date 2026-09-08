import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { resolveGeo } from '@/lib/guard';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const schema = z.object({
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
  email: z.string().email(),
  company: z.string().max(160).optional(),
  inquiry_type: z.string().max(80).optional(),
  budget: z.string().max(80).optional(),
  message: z.string().max(4000).optional(),
});

const esc = (s: unknown) =>
  String(s ?? '—').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);

/** POST /api/contact — the "Request a Campaign / Inquiry" form. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const geo = await resolveGeo();
  const data = parsed.data;

  const message = await db.insert('contact_messages', {
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
    email: data.email.toLowerCase(),
    company: data.company ?? null,
    inquiry_type: data.inquiry_type ?? null,
    budget: data.budget ?? null,
    message: data.message ?? null,
    country: geo.country,
    status: 'new',
    created_at: new Date().toISOString(),
  });

  await sendEmail(
    {
      to: config.email.salesEmail,
      template: 'admin_contact_message',
      subject: `[Inquiry${geo.country ? ` · ${geo.country}` : ''}] ${data.inquiry_type ?? 'General'} — ${data.company ?? data.email}`,
      html: `<h2>New inquiry from the website</h2>
        <p><strong>Name:</strong> ${esc(`${data.first_name ?? ''} ${data.last_name ?? ''}`.trim())}<br>
        <strong>Email:</strong> ${esc(data.email)}<br>
        <strong>Company:</strong> ${esc(data.company)}<br>
        <strong>Type:</strong> ${esc(data.inquiry_type)}<br>
        <strong>Budget:</strong> ${esc(data.budget)}<br>
        <strong>Country:</strong> ${esc(geo.country)}</p>
        <p><strong>Message</strong><br>${esc(data.message).replace(/\n/g, '<br>')}</p>`,
    },
    { type: 'contact_message', id: message.id },
  );

  return NextResponse.json({ ok: true, id: message.id }, { status: 201 });
}
