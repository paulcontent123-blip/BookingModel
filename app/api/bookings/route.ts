import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { assertCanTransact, resolveGeo } from '@/lib/guard';
import { createPaidBooking } from '@/lib/services/booking';

export const runtime = 'nodejs';

const schema = z.object({
  creatorId: z.string().min(1),
  campaignId: z.string().nullish(),
  quantity: z.coerce.number().int().min(1).max(50),
  contentType: z.string().min(1).max(120),
  brief: z.string().max(5000).nullish(),
  dueDate: z.string().nullish(),
  brandName: z.string().min(1).max(160),
  brandEmail: z.string().email(),
  billingCompany: z.string().max(160).nullish(),
  billingAddress: z.string().max(400).nullish(),
  paymentMethod: z.enum(['stripe', 'paypal']).default('stripe'),
  paymentToken: z.string().max(40).nullish(),
});

/**
 * POST /api/bookings — create a paid booking.
 *
 * Requirement #1 is enforced here, not in the UI: the geo gate runs before any
 * money is touched, and a blocked request gets a 403 with GEO_RESTRICTED so the
 * client can open the lead form (requirement #2).
 */
export async function POST(req: Request) {
  const rejection = await assertCanTransact();
  if (rejection) return NextResponse.json(rejection.body, { status: rejection.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the booking details.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const [user, geo] = await Promise.all([getSessionUser(), resolveGeo()]);

  const result = await createPaidBooking({
    creatorId: input.creatorId,
    campaignId: input.campaignId ?? null,
    quantity: input.quantity,
    contentType: input.contentType,
    brief: input.brief ?? null,
    dueDate: input.dueDate ?? null,
    brandId: user?.id ?? null,
    brandName: input.brandName,
    brandEmail: input.brandEmail,
    originCountry: geo.country,
    // Fee tier is resolved from the session, never from the request body.
    brandPlan: user?.plan ?? null,
    paymentMethod: input.paymentMethod,
    paymentToken: input.paymentToken ?? null,
    billing: {
      company: input.billingCompany ?? null,
      address: input.billingAddress ?? null,
    },
  });

  if (!result.ok) {
    const status = result.code === 'PAYMENT_FAILED' ? 402 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code, clientSecret: result.clientSecret ?? null },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      deal_ref: result.deal.deal_ref,
      invoice_no: result.invoice.invoice_no,
      total_usd: result.deal.total_usd,
      creator_notified: result.notifications.creatorEmailed,
    },
    { status: 201 },
  );
}
