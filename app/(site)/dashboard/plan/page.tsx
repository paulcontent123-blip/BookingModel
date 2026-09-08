import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser, revealQuota } from '@/lib/auth';
import { config } from '@/lib/config';
import {
  PLAN_FEATURE_LABELS,
  PLAN_HIGHLIGHTS,
  PLAN_ORDER,
  PLANS,
  planDefinition,
  planName,
  planRank,
  revealLimitLabel,
  type PlanFeature,
} from '@/lib/plans';
import { selfServeCheckoutAvailable } from '@/lib/payments/subscriptions';
import { pendingUpgradeRequest, startPlanUpgradeAction } from '@/lib/services/plan-actions';
import { CancelUpgradeButton } from '@/components/plan-cancel-upgrade';
import { PlanUpgradeButton } from '@/components/plan-upgrade-button';

export const metadata: Metadata = { title: 'My Plan' };

/** Copy shown when a page redirected here because the plan does not cover it. */
const LOCKED_REASON: Record<string, string> = {
  brief_builder: 'The campaign brief builder is part of the paid plans.',
  saved_creators: 'Saving and shortlisting creators is part of the paid plans.',
  analytics: 'Analytics and deal tracking are part of the Pro plan.',
  contact_reveals: 'Creator contact details are part of the paid plans.',
  advanced_filters: 'Engagement-rate and rate filters are part of the paid plans.',
  managed_outreach: 'Managed creator outreach is part of the Enterprise plan.',
  account_manager: 'A dedicated account manager is part of the Enterprise plan.',
};

function banner(params: Record<string, string | undefined>): { tone: string; text: string } | null {
  const { upgrade, plan, message } = params;
  if (!upgrade) return null;
  if (upgrade === 'success') {
    return { tone: 'success', text: `Payment received — you are now on the ${plan ?? 'new'} plan.` };
  }
  if (upgrade === 'requested') {
    return {
      tone: 'info',
      text: 'Thanks — your request is with the VEA team. Nothing has been charged yet and your current plan keeps working.',
    };
  }
  if (upgrade === 'pending') {
    return { tone: 'warning', text: 'Your payment has not settled yet. We will apply the plan as soon as it clears.' };
  }
  if (upgrade === 'cancelled') {
    return { tone: 'warning', text: 'Checkout was cancelled — your plan is unchanged.' };
  }
  return { tone: 'warning', text: message ?? 'That upgrade could not be completed.' };
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const [quota, openRequest] = await Promise.all([
    revealQuota(user),
    pendingUpgradeRequest(user.id),
  ]);

  const current = planDefinition(user.plan);
  const notice = banner(params);
  const lockedFeature = params.locked && params.locked in LOCKED_REASON ? params.locked : null;
  const selfServe = selfServeCheckoutAvailable();
  const features = Object.keys(PLAN_FEATURE_LABELS) as PlanFeature[];

  return (
    <div className="brand-dashboard-subpage brand-dashboard-wide">
      <div className="brand-dashboard-page-header">
        <div>
          <h1>My Plan</h1>
          <p>Manage your subscription, entitlements and usage.</p>
        </div>
        <Link href="/dashboard/creators" className="brand-dashboard-primary-link">Browse Creators</Link>
      </div>

      {lockedFeature && (
        <div className="brand-dashboard-alert warning">
          <strong>{LOCKED_REASON[lockedFeature]}</strong> Pick a plan below to unlock it.
        </div>
      )}

      {notice && (
        <div className={`brand-dashboard-alert ${notice.tone}`}>{notice.text}</div>
      )}

      <div className="brand-dashboard-plan-banner">
        <div className="brand-dashboard-plan-icon">💳</div>
        <div>
          <strong>You are on the {current.name} plan</strong>
          <p>
            {current.summary}{' '}
            {quota.entitled
              ? `Contact reveals today: ${quota.used}/${revealLimitLabel(user.plan)}.`
              : 'Creator contact details are hidden on this plan.'}{' '}
            Booking fee: {current.feePercent}%.
          </p>
        </div>
        <button type="button" className="brand-plan-manage" disabled>Manage billing</button>
      </div>

      {openRequest && (
        <div className="brand-dashboard-alert info">
          <strong>{planName(openRequest.to_plan)} request pending.</strong>{' '}
          Our team is setting up your {planName(openRequest.to_plan)} plan. Your{' '}
          {planName(openRequest.from_plan)} plan stays active until then.{' '}
          <CancelUpgradeButton />
        </div>
      )}

      <div className="brand-plan-grid brand-plan-grid-4">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const isCurrent = key === user.plan;
          const isDowngrade = planRank(key) < planRank(user.plan);
          const requested = openRequest?.to_plan === key;

          return (
            <div className={`brand-plan-card${isCurrent ? ' current' : ''}`} key={key}>
              {isCurrent && <span className="brand-plan-current-badge">Current plan</span>}
              {requested && !isCurrent && <span className="brand-plan-current-badge">Requested</span>}

              <div className="brand-plan-name">{plan.name}</div>
              <div className="brand-plan-price">
                {plan.priceLabel}
                {plan.priceUsd === null ? <span> pricing</span> : <span>/mo</span>}
              </div>
              <div className="brand-plan-description">{plan.audience}</div>

              <div className="brand-plan-features">
                {PLAN_HIGHLIGHTS[key].map((f) => <div key={f}>✓ {f}</div>)}
              </div>

              {isCurrent || isDowngrade ? (
                <button className="brand-plan-button current" disabled type="button">
                  {isCurrent ? 'Your plan' : 'Included in your plan'}
                </button>
              ) : (
                <PlanUpgradeButton
                  action={startPlanUpgradeAction}
                  plan={key}
                  planName={plan.name}
                  priceLabel={plan.priceLabel}
                  priceUsd={plan.priceUsd}
                  stripeLive={selfServe}
                  disabled={requested}
                  buttonLabel={
                    requested
                      ? 'Request pending'
                      : plan.priceUsd === null
                        ? 'Talk to sales'
                        : selfServe
                          ? `Upgrade to ${plan.name}`
                          : `Request ${plan.name}`
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="brand-plan-compare">
        <h2>What each plan includes</h2>
        <div className="brand-plan-compare-scroll">
          <table>
            <thead>
              <tr>
                <th>Entitlement</th>
                {PLAN_ORDER.map((key) => (
                  <th key={key} className={key === user.plan ? 'on' : undefined}>{PLANS[key].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Monthly price</th>
                {PLAN_ORDER.map((key) => (
                  <td key={key} className={key === user.plan ? 'on' : undefined}>
                    {PLANS[key].priceUsd === null ? 'Custom' : `${PLANS[key].priceLabel}/mo`}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Platform fee on bookings</th>
                {PLAN_ORDER.map((key) => (
                  <td key={key} className={key === user.plan ? 'on' : undefined}>
                    {PLANS[key].feePercent}%
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Contact reveals per day</th>
                {PLAN_ORDER.map((key) => (
                  <td key={key} className={key === user.plan ? 'on' : undefined}>
                    {revealLimitLabel(key)}
                  </td>
                ))}
              </tr>
              {features.map((feature) => (
                <tr key={feature}>
                  <th scope="row">{PLAN_FEATURE_LABELS[feature]}</th>
                  {PLAN_ORDER.map((key) => (
                    <td
                      key={key}
                      className={`${key === user.plan ? 'on ' : ''}${PLANS[key].features[feature] ? 'yes' : 'no'}`}
                    >
                      {PLANS[key].features[feature] ? '✓' : '✕'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="brand-plan-compare-note">
          Contact reveals are counted per creator per day — re-opening a creator you already
          unlocked today does not use another reveal. The quota resets at midnight UTC.
        </p>
      </div>

      {!selfServe && (
        <div className="brand-dashboard-alert warning">
          <strong>Payments are currently in demo mode.</strong> Choosing Stripe or PayPal shows a
          successful demo payment and sends the upgrade request to the VEA team for approval. To turn
          on real Stripe Checkout later, set <code>PAYMENT_PROVIDER=stripe</code> and a real{' '}
          <code>STRIPE_SECRET_KEY</code>. Current provider: <strong>{config.payments.provider}</strong>.
        </div>
      )}
    </div>
  );
}
