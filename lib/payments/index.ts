import 'server-only';
import crypto from 'node:crypto';
import { config } from '@/lib/config';
import { planFeePercent } from '@/lib/plans';
import type { Plan } from '@/lib/types';

/**
 * Payment abstraction.
 *
 * The provider is not decided yet (requirement #3: "dùng dịch vụ nào để thanh
 * toán thì tính sau"), so the whole booking flow talks to this interface only.
 * Switching later is a one-line change in .env — no application code moves.
 *
 *   PAYMENT_PROVIDER=mock    (default) always succeeds, issues a real invoice
 *   PAYMENT_PROVIDER=stripe  uses STRIPE_SECRET_KEY once you fill it in
 */

export interface ChargeInput {
  amountUsd: number;
  currency?: string;
  reference: string; // deal_ref
  description: string;
  customerEmail: string;
  customerName?: string | null;
  metadata?: Record<string, string>;
  /** Card details are never handled by this app — tokenised by the provider. */
  token?: string | null;
}

export interface ChargeResult {
  ok: boolean;
  provider: string;
  paymentRef: string | null;
  status: 'succeeded' | 'requires_action' | 'failed';
  /** Present when the provider needs the browser to finish the payment. */
  redirectUrl?: string | null;
  clientSecret?: string | null;
  error?: string;
  last4?: string | null;
  brand?: string | null;
}

export type PaymentMethod = 'stripe' | 'paypal';

export interface PaymentProvider {
  readonly name: string;
  readonly isLive: boolean;
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(paymentRef: string, amountUsd?: number): Promise<{ ok: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Mock provider — lets the entire flow (booking → payment → invoice → email)
// be demonstrated end to end with no merchant account.
// ---------------------------------------------------------------------------
const mockProvider: PaymentProvider = {
  name: 'mock',
  isLive: false,

  async charge(input) {
    if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
      return { ok: false, provider: 'mock', paymentRef: null, status: 'failed', error: 'Invalid amount' };
    }

    // A card number ending in 0000 fails on purpose, so the failure path is testable.
    if (input.token && /0000$/.test(input.token)) {
      return {
        ok: false, provider: 'mock', paymentRef: null, status: 'failed',
        error: 'Your card was declined. Please try a different payment method.',
      };
    }

    const last4 = input.token ? input.token.replace(/\D/g, '').slice(-4) : '4242';

    return {
      ok: true,
      provider: 'mock',
      paymentRef: `mock_pi_${crypto.randomBytes(10).toString('hex')}`,
      status: 'succeeded',
      last4,
      brand: 'Visa (test)',
    };
  },

  async refund(paymentRef) {
    console.info(`[payments:mock] refunded ${paymentRef}`);
    return { ok: true };
  },
};

// ---------------------------------------------------------------------------
// Stripe provider — wired but inert until STRIPE_SECRET_KEY is real.
// Install the SDK when you switch:  npm i stripe
// ---------------------------------------------------------------------------
const stripeProvider: PaymentProvider = {
  name: 'stripe',
  get isLive() {
    return config.payments.stripe.enabled;
  },

  async charge(input) {
    if (!config.payments.stripe.enabled) {
      return {
        ok: false, provider: 'stripe', paymentRef: null, status: 'failed',
        error: 'Stripe is selected but STRIPE_SECRET_KEY is still a placeholder. Set a real key or use PAYMENT_PROVIDER=mock.',
      };
    }

    // Server-side PaymentIntent via the REST API — no SDK dependency needed.
    const body = new URLSearchParams({
      amount: String(Math.round(input.amountUsd * 100)),
      currency: (input.currency ?? 'usd').toLowerCase(),
      description: input.description,
      receipt_email: input.customerEmail,
      'automatic_payment_methods[enabled]': 'true',
      'metadata[reference]': input.reference,
    });
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      body.append(`metadata[${k}]`, v);
    }

    try {
      const res = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.payments.stripe.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = (await res.json()) as {
        id?: string;
        client_secret?: string;
        status?: string;
        error?: { message: string };
      };

      if (!res.ok || data.error) {
        return {
          ok: false, provider: 'stripe', paymentRef: null, status: 'failed',
          error: data.error?.message ?? `Stripe returned ${res.status}`,
        };
      }

      return {
        ok: true,
        provider: 'stripe',
        paymentRef: data.id ?? null,
        // The browser confirms the intent with Stripe.js — this is not "paid" yet.
        status: 'requires_action',
        clientSecret: data.client_secret ?? null,
      };
    } catch (err) {
      return {
        ok: false, provider: 'stripe', paymentRef: null, status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async refund(paymentRef, amountUsd) {
    if (!config.payments.stripe.enabled) return { ok: false, error: 'Stripe not configured' };
    const body = new URLSearchParams({ payment_intent: paymentRef });
    if (amountUsd) body.append('amount', String(Math.round(amountUsd * 100)));
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.payments.stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) return { ok: false, error: `Stripe returned ${res.status}` };
    return { ok: true };
  },
};

const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  stripe: stripeProvider,
};

export function paymentProvider(requestedMethod?: PaymentMethod): PaymentProvider {
  // The checkout modal can already collect the brand's preferred service. The
  // PayPal adapter will be added when its credentials are configured; until
  // then PayPal deliberately falls back to the safe local provider.
  const selectedProvider = requestedMethod ?? config.payments.provider;
  if (selectedProvider === 'paypal') return mockProvider;

  const chosen = providers[selectedProvider];
  if (!chosen) {
    console.warn(`[payments] unknown provider "${selectedProvider}", falling back to mock`);
    return mockProvider;
  }
  // Selected Stripe but the key is still a placeholder — stay usable.
  if (chosen.name === 'stripe' && !config.payments.stripe.enabled) {
    console.warn('[payments] STRIPE_SECRET_KEY is a placeholder — using the mock provider');
    return mockProvider;
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------
export interface PriceBreakdown {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  platformFee: number;
  tax: number;
  total: number;
  feePercent: number;
  taxPercent: number;
}

/**
 * Prices a booking for a brand on `plan`.
 *
 * The fee tier is part of what a plan sells (Pro 10%, Enterprise 8%), so it is
 * resolved from lib/plans.ts rather than from a single flat env var. `plan` is
 * always read from the server session — a caller must never accept it from the
 * browser. Signed-out checkout is priced at the Free rate, which is what the
 * public creator pages quote.
 */
export function priceBooking(
  unitPrice: number,
  quantity: number,
  plan: Plan | null = 'free',
): PriceBreakdown {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const unit = Math.max(0, Math.round(unitPrice || 0));
  const subtotal = unit * qty;
  const feePercent = planFeePercent(plan ?? 'free');
  const platformFee = Math.round((subtotal * feePercent) / 100);
  const tax = Math.round(((subtotal + platformFee) * config.payments.taxPercent) / 100);
  return {
    quantity: qty,
    unitPrice: unit,
    subtotal,
    platformFee,
    tax,
    total: subtotal + platformFee + tax,
    feePercent,
    taxPercent: config.payments.taxPercent,
  };
}
