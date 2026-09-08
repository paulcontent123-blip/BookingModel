'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanActionResult } from '@/lib/services/plan-actions';
import type { Plan } from '@/lib/types';

type UpgradeAction = (formData: FormData) => Promise<PlanActionResult>;

export function PlanUpgradeButton({
  action,
  plan,
  planName,
  priceLabel,
  priceUsd,
  buttonLabel,
  stripeLive,
  disabled = false,
}: {
  action: UpgradeAction;
  plan: Plan;
  planName: string;
  priceLabel: string;
  priceUsd: number | null;
  buttonLabel: string;
  stripeLive: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe');
  const [result, setResult] = useState<PlanActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const salesLed = priceUsd === null;

  const close = () => {
    if (pending) return;
    setOpen(false);
    setResult(null);
  };

  const openModal = () => {
    setPaymentMethod('stripe');
    setResult(null);
    setOpen(true);
  };

  const confirmPayment = () => {
    const formData = new FormData();
    formData.set('plan', plan);
    formData.set('payment_method', salesLed ? 'sales' : paymentMethod);

    startTransition(async () => {
      const next = await action(formData);
      if (next.checkoutUrl) {
        window.location.assign(next.checkoutUrl);
        return;
      }
      setResult(next);
    });
  };

  return (
    <>
      <button className="brand-plan-button" type="button" onClick={openModal} disabled={disabled}>
        {buttonLabel}
      </button>

      {open && (
        <div
          className="brand-upgrade-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`upgrade-title-${plan}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="brand-upgrade-modal-card">
            <div className="brand-upgrade-modal-header">
              <div>
                <div className="brand-upgrade-modal-eyebrow">Plan upgrade</div>
                <h2 id={`upgrade-title-${plan}`}>Upgrade to {planName}</h2>
              </div>
              <button className="brand-upgrade-modal-close" type="button" onClick={close} disabled={pending} aria-label="Close">
                ×
              </button>
            </div>

            {result?.ok ? (
              <div className="brand-upgrade-modal-success">
                <div className="brand-upgrade-success-icon">✓</div>
                <h3>{salesLed ? 'Request sent' : 'Payment successful'}</h3>
                <p>
                  {salesLed
                    ? <>Your request for the <strong>{planName}</strong> plan has been sent to the VEA admin.</>
                    : <>This is demo payment mode, so no money was charged. Your upgrade request for the{' '}
                        <strong>{planName}</strong> plan has been sent to the VEA admin.</>}
                </p>
                <p className="brand-upgrade-modal-muted">
                  Your plan will change after the admin approves the request.
                </p>
                <div className="brand-upgrade-modal-actions">
                  <button className="brand-upgrade-secondary" type="button" onClick={close}>
                    Close
                  </button>
                  <button
                    className="brand-upgrade-primary"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setResult(null);
                      router.refresh();
                    }}
                  >
                    View request
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="brand-upgrade-modal-body">
                  <div className="brand-upgrade-summary">
                    <span>Selected plan</span>
                    <strong>{planName}</strong>
                    <b>{priceUsd === null ? 'Custom pricing' : `${priceLabel}/month`}</b>
                  </div>

                  {salesLed ? (
                    <div className="brand-upgrade-demo-note">
                      <strong>Custom pricing</strong>
                      <span>
                        Enterprise upgrades are arranged by the VEA team. Send the request and an admin
                        will contact you with the contract and payment details.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="brand-upgrade-demo-note">
                        <strong>Payment required to send the request</strong>
                        <span>
                          For now, payment is simulated. Pressing the payment button will show a successful
                          payment message and create a request for admin approval. No real charge is made.
                        </span>
                      </div>

                      <div className="brand-upgrade-modal-label">Choose a payment service</div>
                      <div className="brand-upgrade-payment-options">
                    <button
                      className={`brand-upgrade-payment-option${paymentMethod === 'stripe' ? ' selected' : ''}`}
                      type="button"
                      onClick={() => setPaymentMethod('stripe')}
                    >
                      <span className="brand-upgrade-payment-logo stripe">S</span>
                      <span>
                        <strong>Stripe</strong>
                        <small>{stripeLive ? 'Secure checkout' : 'Demo payment'}</small>
                      </span>
                      <span className="brand-upgrade-payment-check">{paymentMethod === 'stripe' ? '✓' : ''}</span>
                    </button>
                    <button
                      className={`brand-upgrade-payment-option${paymentMethod === 'paypal' ? ' selected' : ''}`}
                      type="button"
                      onClick={() => setPaymentMethod('paypal')}
                    >
                      <span className="brand-upgrade-payment-logo paypal">P</span>
                      <span>
                        <strong>PayPal</strong>
                        <small>Demo payment</small>
                      </span>
                      <span className="brand-upgrade-payment-check">{paymentMethod === 'paypal' ? '✓' : ''}</span>
                    </button>
                      </div>
                    </>
                  )}

                  {result && !result.ok && (
                    <div className="brand-upgrade-modal-error" role="alert">{result.message}</div>
                  )}
                </div>

                <div className="brand-upgrade-modal-footer">
                  <button className="brand-upgrade-secondary" type="button" onClick={close} disabled={pending}>
                    Cancel
                  </button>
                  <button className="brand-upgrade-primary" type="button" onClick={confirmPayment} disabled={pending}>
                    {pending ? 'Processing…' : salesLed ? 'Send request' : `Pay with ${paymentMethod === 'stripe' ? 'Stripe' : 'PayPal'}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
