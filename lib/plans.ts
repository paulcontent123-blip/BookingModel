import type { Plan } from './types';

/**
 * Single source of truth for the Brand subscription tiers.
 *
 * Reconciles the two source documents, which disagreed with each other:
 *
 *   • CMD v2.0 (Aug 2026) + bookingmodel_internal_v3.html
 *       Free $0 · Standard $49 · Pro $149, contact reveals 0 / 10-a-day / ∞
 *   • TechSpec slides 5, 9, 10
 *       three tiers ending in an Enterprise plan with managed creator outreach
 *       and a dedicated account manager; platform fee Standard 15%, Pro 10%
 *
 * The agreed model keeps CMD v2.0's names and prices and adds the TechSpec
 * Enterprise tier on top. Every gate in the app reads this file — nothing else
 * may hard-code a plan name, a price, a fee percentage or a reveal quota.
 */

export type PlanFeature =
  /** Reveal a creator's verified contact details (subject to a daily quota). */
  | 'contact_reveals'
  /** Campaign brief builder under /dashboard/brief. */
  | 'brief_builder'
  /** Engagement-rate and max-rate filters on the creator search. */
  | 'advanced_filters'
  /** Shortlist creators (saved_creators / lightweight CRM). */
  | 'saved_creators'
  /** Spend + performance reporting on the dashboard. */
  | 'analytics'
  | 'priority_support'
  /** The VEA team reaches out to creators on the brand's behalf. */
  | 'managed_outreach'
  | 'account_manager';

export interface PlanDefinition {
  key: Plan;
  name: string;
  /** Monthly price in whole USD. `null` means "contact sales" (Enterprise). */
  priceUsd: number | null;
  priceLabel: string;
  audience: string;
  summary: string;
  /** Platform fee charged on top of a booking subtotal, in percent. */
  feePercent: number;
  /**
   * Distinct creators whose contact details may be revealed per calendar day.
   * `0` locks contacts entirely; `Infinity` is unlimited.
   */
  dailyReveals: number;
  features: Record<PlanFeature, boolean>;
}

const NO_FEATURES: Record<PlanFeature, boolean> = {
  contact_reveals: false,
  brief_builder: false,
  advanced_filters: false,
  saved_creators: false,
  analytics: false,
  priority_support: false,
  managed_outreach: false,
  account_manager: false,
};

/** Low to high. Index doubles as the plan rank used by `planAtLeast`. */
export const PLAN_ORDER: Plan[] = ['free', 'standard', 'pro', 'enterprise'];

export const PLANS: Record<Plan, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    priceUsd: 0,
    priceLabel: '$0',
    audience: 'Browse only',
    summary: 'Browse creator profiles and see rates and audience data.',
    feePercent: 15,
    dailyReveals: 0,
    features: { ...NO_FEATURES },
  },

  standard: {
    key: 'standard',
    name: 'Standard',
    priceUsd: 49,
    priceLabel: '$49',
    audience: 'Growing brands',
    summary: '10 creator contact reveals per day, brief builder and shortlists.',
    feePercent: 15,
    dailyReveals: 10,
    features: {
      ...NO_FEATURES,
      contact_reveals: true,
      brief_builder: true,
      advanced_filters: true,
      saved_creators: true,
    },
  },

  pro: {
    key: 'pro',
    name: 'Pro',
    priceUsd: 149,
    priceLabel: '$149',
    audience: 'Agencies and power users',
    summary: 'Unlimited contact reveals, analytics and a reduced platform fee.',
    feePercent: 10,
    dailyReveals: Number.POSITIVE_INFINITY,
    features: {
      ...NO_FEATURES,
      contact_reveals: true,
      brief_builder: true,
      advanced_filters: true,
      saved_creators: true,
      analytics: true,
      priority_support: true,
    },
  },

  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    priceUsd: null,
    priceLabel: 'Custom',
    audience: 'Managed accounts',
    summary: 'Everything in Pro plus managed creator outreach by the VEA team.',
    feePercent: 8,
    dailyReveals: Number.POSITIVE_INFINITY,
    features: {
      contact_reveals: true,
      brief_builder: true,
      advanced_filters: true,
      saved_creators: true,
      analytics: true,
      priority_support: true,
      managed_outreach: true,
      account_manager: true,
    },
  },
};

/**
 * Marketing bullets for the plan cards. Kept next to the matrix so a feature
 * cannot be advertised on a card without the matrix granting it.
 */
export const PLAN_HIGHLIGHTS: Record<Plan, string[]> = {
  free: [
    'Browse the full vetted roster',
    'See rates and audience data',
    'Book and pay per campaign',
    'Contact details hidden',
  ],
  standard: [
    'Everything in Free',
    `${PLANS.standard.dailyReveals} contact reveals per day`,
    'Campaign brief builder',
    'Advanced filters (ER, rate)',
    'Saved creators / shortlists',
  ],
  pro: [
    'Everything in Standard',
    'Unlimited contact reveals',
    'Analytics and deal tracking',
    'Priority support',
    `Reduced platform fee (${PLANS.pro.feePercent}%)`,
  ],
  enterprise: [
    'Everything in Pro',
    'VEA team notifies creators for you',
    'Dedicated account manager',
    `Lowest platform fee (${PLANS.enterprise.feePercent}%)`,
    'Custom contract and invoicing',
  ],
};

/** Human labels for the feature keys — used by the comparison table. */
export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  contact_reveals: 'View creator contact info',
  brief_builder: 'Campaign brief builder',
  advanced_filters: 'Advanced filters (ER, rate)',
  saved_creators: 'Creator shortlisting / CRM',
  analytics: 'Analytics and deal tracking',
  priority_support: 'Priority support',
  managed_outreach: 'VEA team notifies creators',
  account_manager: 'Dedicated account manager',
};

export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLAN_ORDER as string[]).includes(value);
}

/** Falls back to Free for anything unrecognised — never throws on bad data. */
export function planOf(value: unknown): Plan {
  return isPlan(value) ? value : 'free';
}

export function planDefinition(plan: unknown): PlanDefinition {
  return PLANS[planOf(plan)];
}

export function planName(plan: unknown): string {
  return planDefinition(plan).name;
}

export function planRank(plan: unknown): number {
  return PLAN_ORDER.indexOf(planOf(plan));
}

/** True when `plan` is `minimum` or better. */
export function planAtLeast(plan: unknown, minimum: Plan): boolean {
  return planRank(plan) >= planRank(minimum);
}

export function planHasFeature(plan: unknown, feature: PlanFeature): boolean {
  return planDefinition(plan).features[feature];
}

/** The cheapest plan that includes `feature`, or null if no plan does. */
export function lowestPlanWith(feature: PlanFeature): Plan | null {
  return PLAN_ORDER.find((p) => PLANS[p].features[feature]) ?? null;
}

/**
 * Platform fee for a booking. Signed-out checkout has no plan and is charged
 * the Free rate, which is what the public creator pages quote.
 */
export function planFeePercent(plan: unknown): number {
  return planDefinition(plan).feePercent;
}

export function dailyRevealLimit(plan: unknown): number {
  return planDefinition(plan).dailyReveals;
}

export function isUnlimitedReveals(plan: unknown): boolean {
  return dailyRevealLimit(plan) === Number.POSITIVE_INFINITY;
}

/** "10" / "∞" / "0" — for quota counters in the UI. */
export function revealLimitLabel(plan: unknown): string {
  const limit = dailyRevealLimit(plan);
  return limit === Number.POSITIVE_INFINITY ? '∞' : String(limit);
}

/** Plans a brand on `plan` can move up to, in display order. */
export function upgradeTargets(plan: unknown): PlanDefinition[] {
  const rank = planRank(plan);
  return PLAN_ORDER.slice(rank + 1).map((p) => PLANS[p]);
}

/** Plans that must be bought through sales rather than self-serve checkout. */
export function isSalesLed(plan: unknown): boolean {
  return planDefinition(plan).priceUsd === null;
}
