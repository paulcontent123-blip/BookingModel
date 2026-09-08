import 'server-only';
import { config } from '@/lib/config';
import { PLANS, planDefinition } from '@/lib/plans';
import type { Plan } from '@/lib/types';

/**
 * Self-serve plan upgrades.
 *
 * Uses Stripe Checkout in subscription mode through the REST API, so no SDK is
 * required. `price_data` builds the recurring price inline — there is no need
 * to pre-create Products and Prices in the Stripe dashboard before the first
 * upgrade works.
 *
 * When PAYMENT_PROVIDER is not `stripe`, or STRIPE_SECRET_KEY is still a
 * placeholder, the caller falls back to the reviewed upgrade-request flow, so
 * the button is never a dead end.
 */

export function selfServeCheckoutAvailable(): boolean {
  return config.payments.provider === 'stripe' && config.payments.stripe.enabled;
}

export interface CheckoutSessionResult {
  ok: boolean;
  url?: string;
  sessionId?: string;
  error?: string;
}

async function stripe(
  path: string,
  init: { method: 'GET' | 'POST'; body?: URLSearchParams },
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${config.payments.stripe.secretKey}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: init.body,
    cache: 'no-store',
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

function stripeError(data: Record<string, unknown>, status: number): string {
  const err = data.error as { message?: string } | undefined;
  return err?.message ?? `Stripe returned ${status}`;
}

export async function createPlanCheckoutSession(input: {
  userId: string;
  email: string;
  plan: Plan;
  requestId: string;
}): Promise<CheckoutSessionResult> {
  if (!selfServeCheckoutAvailable()) {
    return { ok: false, error: 'Stripe is not configured.' };
  }

  const definition = planDefinition(input.plan);
  if (definition.priceUsd === null) {
    return { ok: false, error: `${definition.name} is sold through the sales team.` };
  }

  const returnUrl = `${config.site.url}/api/billing/plan-return`;
  const body = new URLSearchParams({
    mode: 'subscription',
    customer_email: input.email,
    // The return route re-reads the session from Stripe before touching the
    // plan, so this id in the URL is a lookup key and not an authorisation.
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.site.url}/dashboard/plan?upgrade=cancelled`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(definition.priceUsd * 100),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': `BookingModel ${definition.name} plan`,
    'line_items[0][price_data][product_data][description]': definition.summary,
    'metadata[user_id]': input.userId,
    'metadata[plan]': input.plan,
    'metadata[upgrade_request_id]': input.requestId,
    'subscription_data[metadata][user_id]': input.userId,
    'subscription_data[metadata][plan]': input.plan,
  });

  try {
    const { ok, status, data } = await stripe('checkout/sessions', { method: 'POST', body });
    if (!ok || data.error) return { ok: false, error: stripeError(data, status) };
    return { ok: true, url: String(data.url ?? ''), sessionId: String(data.id ?? '') };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface CheckoutVerification {
  ok: boolean;
  paid: boolean;
  userId: string | null;
  plan: Plan | null;
  requestId: string | null;
  customerId: string | null;
  error?: string;
}

/**
 * Reads a completed Checkout Session back from Stripe.
 *
 * The plan is taken from Stripe's copy of the metadata, never from the query
 * string — otherwise anyone could hand themselves an Enterprise plan by
 * editing the return URL.
 */
export async function verifyPlanCheckoutSession(
  sessionId: string,
): Promise<CheckoutVerification> {
  const empty: CheckoutVerification = {
    ok: false, paid: false, userId: null, plan: null, requestId: null, customerId: null,
  };

  if (!selfServeCheckoutAvailable()) return { ...empty, error: 'Stripe is not configured.' };
  if (!sessionId) return { ...empty, error: 'Missing checkout session.' };

  try {
    const { ok, status, data } = await stripe(
      `checkout/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'GET' },
    );
    if (!ok || data.error) return { ...empty, error: stripeError(data, status) };

    const metadata = (data.metadata ?? {}) as Record<string, string | undefined>;
    const plan = metadata.plan;
    const isKnownPlan = typeof plan === 'string' && plan in PLANS;

    return {
      ok: true,
      paid: data.payment_status === 'paid' || data.status === 'complete',
      userId: metadata.user_id ?? null,
      plan: isKnownPlan ? (plan as Plan) : null,
      requestId: metadata.upgrade_request_id ?? null,
      customerId: typeof data.customer === 'string' ? data.customer : null,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
