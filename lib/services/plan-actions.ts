'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser, requireUser } from '@/lib/auth';
import {
  adminUpgradeRequestEmail,
  brandUpgradeRequestedEmail,
  sendAll,
} from '@/lib/email';
import { createPlanCheckoutSession, selfServeCheckoutAvailable } from '@/lib/payments/subscriptions';
import { isPlan, isSalesLed, planName, planRank } from '@/lib/plans';
import type { Plan, UpgradeRequest } from '@/lib/types';

/**
 * The plan upgrade flow.
 *
 *   Stripe key present + self-serve tier -> Checkout Session, plan applied by
 *                                           /api/billing/plan-return
 *   otherwise, or Enterprise             -> upgrade_requests row reviewed by
 *                                           the VEA team in the admin dashboard
 *
 * A plan is never written here from user input. The only paths that change
 * `users.plan` are the verified Stripe return route and an admin approval.
 */

export interface PlanActionResult {
  ok: boolean;
  message: string;
  /** Set when the caller should send the browser to Stripe Checkout. */
  checkoutUrl?: string;
}

export async function pendingUpgradeRequest(userId: string): Promise<UpgradeRequest | null> {
  return db.findOne('upgrade_requests', { user_id: userId, status: 'pending' });
}

/**
 * Starts an upgrade to `plan`.
 *
 * Downgrades and same-plan clicks are refused: billing changes that reduce what
 * a brand paid for are a support conversation, not a button.
 */
export async function startPlanUpgradeAction(formData: FormData): Promise<PlanActionResult> {
  const user = await requireUser('/login?next=/dashboard/plan');
  const target = String(formData.get('plan') ?? '');
  const noteFromForm = String(formData.get('note') ?? '').trim();
  const requestedPaymentMethod = String(formData.get('payment_method') ?? '').trim().toLowerCase();
  const paymentMethod = requestedPaymentMethod === 'paypal'
    || requestedPaymentMethod === 'stripe'
    || requestedPaymentMethod === 'sales'
    ? requestedPaymentMethod
    : 'mock';

  if (!isPlan(target)) {
    return { ok: false, message: 'Unknown plan.' };
  }
  if (planRank(target) === planRank(user.plan)) {
    return { ok: false, message: `You are already on the ${planName(target)} plan.` };
  }
  if (planRank(target) < planRank(user.plan)) {
    return {
      ok: false,
      message: `To move down from ${planName(user.plan)}, contact us and we will adjust your billing.`,
    };
  }

  const existing = await pendingUpgradeRequest(user.id);
  if (existing && existing.to_plan === target) {
    return {
      ok: false,
      message: `Your ${planName(target)} request is already with our team — we will be in touch shortly.`,
    };
  }
  // A brand may change their mind before we have processed the first request.
  if (existing) {
    await db.update('upgrade_requests', existing.id, {
      status: 'cancelled',
      decided_at: new Date().toISOString(),
    });
  }

  const salesLed = isSalesLed(target);
  const useCheckout = !salesLed && paymentMethod === 'stripe' && selfServeCheckoutAvailable();
  const paymentLabel = paymentMethod === 'paypal'
    ? 'PayPal'
    : paymentMethod === 'stripe'
      ? 'Stripe'
      : paymentMethod === 'sales'
        ? 'Sales request'
        : 'Demo payment';
  const note = [
    noteFromForm,
    `Payment method: ${paymentLabel}${useCheckout ? '' : ' (demo)'}`,
  ].filter(Boolean).join(' · ').slice(0, 1000) || null;

  let request: UpgradeRequest;
  try {
    request = await db.insert('upgrade_requests', {
      user_id: user.id,
      user_email: user.email,
      company_name: user.company_name,
      from_plan: user.plan,
      to_plan: target,
      source: salesLed ? 'sales' : 'self_serve',
      status: 'pending',
      note,
      checkout_session_id: null,
      decided_by: null,
      decided_at: null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[plan] could not record the upgrade request:', error);
    return { ok: false, message: 'Your request could not be saved. Please try again.' };
  }

  if (useCheckout) {
    const session = await createPlanCheckoutSession({
      userId: user.id,
      email: user.email,
      plan: target,
      requestId: request.id,
    });

    if (session.ok && session.url) {
      await db.update('upgrade_requests', request.id, {
        checkout_session_id: session.sessionId ?? null,
      });
      return { ok: true, message: 'Redirecting to secure checkout…', checkoutUrl: session.url };
    }

    // Stripe was configured but refused. Keep the request open and fall back to
    // the reviewed path rather than leaving the brand with a dead button.
    console.error('[plan] Stripe checkout failed, falling back to review:', session.error);
  }

  await sendAll(
    [adminUpgradeRequestEmail(request), brandUpgradeRequestedEmail(request)],
    { type: 'upgrade_request', id: request.id },
  );

  revalidatePath('/dashboard/plan');

  return {
    ok: true,
    message: salesLed
      ? `Thanks — our team will contact you about the ${planName(target)} plan within one business day.`
      : `Thanks — we received your ${planName(target)} request and will set up billing within one business day.`,
  };
}

export async function cancelPlanUpgradeAction(): Promise<PlanActionResult> {
  const user = await requireUser('/login?next=/dashboard/plan');
  const existing = await pendingUpgradeRequest(user.id);
  if (!existing) return { ok: false, message: 'There is no open upgrade request.' };

  await db.update('upgrade_requests', existing.id, {
    status: 'cancelled',
    decided_at: new Date().toISOString(),
  });

  revalidatePath('/dashboard/plan');
  return { ok: true, message: 'Upgrade request cancelled.' };
}

/**
 * Sends the brand to Stripe Checkout from a plain <form action>, so the upgrade
 * works without client-side JavaScript. Falls through to the reviewed path when
 * Stripe is not configured.
 */
export async function submitPlanUpgradeAction(formData: FormData): Promise<void> {
  const result = await startPlanUpgradeAction(formData);

  if (result.checkoutUrl) redirect(result.checkoutUrl);

  const user = await getSessionUser();
  const plan = String(formData.get('plan') ?? '');
  const status = result.ok ? 'requested' : 'error';
  const params = new URLSearchParams({ upgrade: status, plan });
  if (!result.ok) params.set('message', result.message);
  if (!user) redirect('/login?next=/dashboard/plan');

  redirect(`/dashboard/plan?${params.toString()}`);
}
