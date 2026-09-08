import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { brandPlanChangedEmail, sendEmail } from '@/lib/email';
import { verifyPlanCheckoutSession } from '@/lib/payments/subscriptions';
import { planName, planRank } from '@/lib/plans';

export const runtime = 'nodejs';

/**
 * GET /api/billing/plan-return?session_id=… — where Stripe Checkout sends the
 * brand after a successful subscription payment.
 *
 * The new plan is read back from Stripe's own copy of the session metadata, so
 * a hand-edited return URL cannot grant a plan. The session must also belong to
 * the signed-in account.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id') ?? '';
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(
      new URL(`/dashboard/plan?${new URLSearchParams(params).toString()}`, config.site.url),
    );

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/dashboard/plan', config.site.url));
  }

  const session = await verifyPlanCheckoutSession(sessionId);
  if (!session.ok) {
    console.error('[billing] could not verify checkout session:', session.error);
    return back({ upgrade: 'error', message: 'We could not confirm that payment. Our team will follow up.' });
  }
  if (!session.paid) {
    return back({ upgrade: 'pending' });
  }
  // The session belongs to somebody else — never apply it to this account.
  if (session.userId && session.userId !== user.id) {
    return back({ upgrade: 'error', message: 'That checkout session belongs to another account.' });
  }
  if (!session.plan) {
    return back({ upgrade: 'error', message: 'That checkout session has no plan attached.' });
  }

  const previous = user.plan;
  // Replaying an old success URL must not silently move a brand backwards.
  if (planRank(session.plan) > planRank(previous)) {
    await db.update('users', user.id, {
      plan: session.plan,
      stripe_customer_id: session.customerId ?? undefined,
    });
    await sendEmail(brandPlanChangedEmail(user.email, previous, session.plan), {
      type: 'plan_change',
      id: user.id,
    });
  }

  if (session.requestId) {
    const request = await db.get('upgrade_requests', session.requestId);
    if (request && request.status === 'pending') {
      await db.update('upgrade_requests', request.id, {
        status: 'approved',
        decided_at: new Date().toISOString(),
        note: request.note ?? 'Paid through Stripe Checkout.',
      });
    }
  }

  return back({ upgrade: 'success', plan: planName(session.plan) });
}
