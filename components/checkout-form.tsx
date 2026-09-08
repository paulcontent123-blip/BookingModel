'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTENT_TYPES, money } from '@/lib/utils';
import { useGeo } from './geo-provider';

/**
 * Requirement #3 — US brands book and pay here.
 *
 * Payment is confirmed through the provider modal below. Stripe Checkout/
 * Elements or PayPal Buttons can be mounted there later without changing the
 * campaign and billing form.
 */

interface CreatorSummary {
  id: string;
  name: string;
  handle: string;
  platform: string;
  photo_url: string | null;
  accent_bg: string | null;
  emoji: string | null;
  unitPrice: number;
  rateLabel: string;
}

export function CheckoutForm({
  creator,
  defaults,
  payment,
  country,
}: {
  creator: CreatorSummary;
  defaults: { brandName: string; brandEmail: string };
  payment: { feePercent: number; taxPercent: number };
  country: string | null;
}) {
  const router = useRouter();
  const { openRestricted } = useGeo();
  const formRef = useRef<HTMLFormElement>(null);

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe');

  const paymentMethodLabel = paymentMethod === 'stripe' ? 'Stripe' : 'PayPal';

  const price = useMemo(() => {
    const subtotal = creator.unitPrice * quantity;
    const platformFee = Math.round((subtotal * payment.feePercent) / 100);
    const tax = Math.round(((subtotal + platformFee) * payment.taxPercent) / 100);
    return { subtotal, platformFee, tax, total: subtotal + platformFee + tax };
  }, [creator.unitPrice, quantity, payment.feePercent, payment.taxPercent]);

  useEffect(() => {
    if (!paymentModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setPaymentModalOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [paymentModalOpen, submitting]);

  function closePaymentModal() {
    if (submitting) return;
    setPaymentModalOpen(false);
    setError(null);
  }

  function openPaymentModal() {
    setError(null);
    setPaymentMethod('stripe');
    setPaymentModalOpen(true);
  }

  function confirmPayment() {
    const form = formRef.current;
    if (!form) return;

    // Let the user fix missing campaign/billing/payment fields before the
    // modal starts processing the booking.
    if (!form.checkValidity()) {
      form.reportValidity();
      setPaymentModalOpen(false);
      return;
    }

    form.requestSubmit();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Pressing Enter in the checkout form should follow the same confirmation
    // step as clicking the Pay button.
    if (!paymentModalOpen) {
      setPaymentModalOpen(true);
      return;
    }

    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      creatorId: creator.id,
      quantity,
      contentType: String(form.get('contentType') ?? ''),
      brief: String(form.get('brief') ?? ''),
      dueDate: String(form.get('dueDate') ?? '') || null,
      brandName: String(form.get('brandName') ?? ''),
      brandEmail: String(form.get('brandEmail') ?? ''),
      billingCompany: String(form.get('billingCompany') ?? ''),
      billingAddress: String(form.get('billingAddress') ?? ''),
      paymentMethod,
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // The server-side geo gate fired — hand the visitor to the lead form.
      if (res.status === 403 && data.code === 'GEO_RESTRICTED') {
        openRestricted({
          creatorId: creator.id,
          creatorName: `${creator.name} (${creator.handle})`,
          contentType: payload.contentType,
          quantity,
        });
        setError(data.error);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? 'Payment could not be completed.');
      router.push(`/booking/success/${data.deal_ref}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className="book-grid" onSubmit={onSubmit}>
      <div>
        <div className="form-box mb-16">
          <div className="form-title">1. Campaign details</div>

          <div className="fg2">
            <div className="fg">
              <label htmlFor="contentType">Content type *</label>
              <select id="contentType" name="contentType" required defaultValue={CONTENT_TYPES[0]}>
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg">
              <label htmlFor="quantity">Number of videos *</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                required
              />
            </div>
          </div>

          <div className="fg">
            <label htmlFor="dueDate">Requested delivery date</label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="fg">
            <label htmlFor="brief">Creative brief *</label>
            <textarea
              id="brief"
              name="brief"
              rows={5}
              required
              placeholder="Product, key message, hooks, must-say points, tone, do-not-say list…"
            />
          </div>
        </div>

        <div className="form-box mb-16">
          <div className="form-title">2. Billing details</div>
          <div className="fg2">
            <div className="fg">
              <label htmlFor="brandName">Brand / Company *</label>
              <input id="brandName" name="brandName" required defaultValue={defaults.brandName} />
            </div>
            <div className="fg">
              <label htmlFor="brandEmail">Email for invoice *</label>
              <input
                id="brandEmail"
                name="brandEmail"
                type="email"
                required
                defaultValue={defaults.brandEmail}
              />
            </div>
          </div>
          <div className="fg">
            <label htmlFor="billingCompany">Legal entity name</label>
            <input id="billingCompany" name="billingCompany" placeholder="Same as brand if blank" />
          </div>
          <div className="fg">
            <label htmlFor="billingAddress">Billing address</label>
            <textarea id="billingAddress" name="billingAddress" rows={2} placeholder="Street, City, State, ZIP" />
          </div>
        </div>

      </div>

      <aside className="summary-card">
        <div className="sec-eye" style={{ marginBottom: 10 }}>Order summary</div>

        <div className="row gap-12 mb-16">
          <div
            style={{
              width: 46, height: 46, borderRadius: 6, flexShrink: 0,
              background: creator.photo_url
                ? `#EEE url(${creator.photo_url}) center top / cover`
                : (creator.accent_bg ?? 'var(--bg2)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}
          >
            {!creator.photo_url && creator.emoji}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mont)', fontWeight: 700, fontSize: 13.5 }}>{creator.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{creator.handle} · {creator.platform}</div>
          </div>
        </div>

        <div className="summary-line">
          <span>{quantity} × {money(creator.unitPrice)}</span>
          <strong>{money(price.subtotal)}</strong>
        </div>
        <div className="summary-line">
          <span>Platform fee ({payment.feePercent}%)</span>
          <strong>{money(price.platformFee)}</strong>
        </div>
        {payment.taxPercent > 0 && (
          <div className="summary-line">
            <span>Tax ({payment.taxPercent}%)</span>
            <strong>{money(price.tax)}</strong>
          </div>
        )}
        <div className="summary-total"><span>Total</span><span>{money(price.total)}</span></div>

        {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}

        <button
          className="submit-btn"
          type="button"
          disabled={submitting}
          style={{ marginTop: 14 }}
          onClick={openPaymentModal}
        >
          {submitting ? <><span className="spinner" /> Processing…</> : `Pay ${money(price.total)} →`}
        </button>

        <p className="summary-note">
          Paying confirms the booking, issues an invoice and emails{' '}
          <strong>{creator.name}</strong> the brief immediately.
          {country && <> Billing region: {country}.</>}
        </p>
      </aside>

      {paymentModalOpen && (
        <div
          className="modal-wrap open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-payment-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePaymentModal();
          }}
        >
          <div className="modal-box payment-confirmation-modal">
            <div className="modal-head">
              <div>
                <div className="payment-modal-kicker">Secure checkout</div>
                <div className="modal-title" id="booking-payment-title">Confirm payment</div>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={closePaymentModal}
                disabled={submitting}
                aria-label="Close payment confirmation"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="payment-modal-intro">
                Review the booking details below. After payment is completed, the booking will be
                confirmed and an invoice will be generated automatically.
              </p>

              <div className="payment-modal-summary">
                <div>
                  <span>Creator</span>
                  <strong>{creator.name}</strong>
                </div>
                <div>
                  <span>Deliverables</span>
                  <strong>{quantity} × {creator.rateLabel}</strong>
                </div>
                <div>
                  <span>Payment method</span>
                  <strong>{paymentMethodLabel}</strong>
                </div>
                <div className="payment-modal-total">
                  <span>Total</span>
                  <strong>{money(price.total)}</strong>
                </div>
              </div>

              <div className="payment-modal-label">Choose a payment service</div>
              <div className="payment-modal-options">
                <button
                  className={`payment-modal-option${paymentMethod === 'stripe' ? ' selected' : ''}`}
                  type="button"
                  onClick={() => setPaymentMethod('stripe')}
                >
                  <span className="payment-modal-provider-mark stripe">S</span>
                  <span>
                    <strong>Stripe</strong>
                    <small>Card, Apple Pay and supported wallets</small>
                  </span>
                  <span className="payment-modal-check">{paymentMethod === 'stripe' ? '✓' : ''}</span>
                </button>
                <button
                  className={`payment-modal-option${paymentMethod === 'paypal' ? ' selected' : ''}`}
                  type="button"
                  onClick={() => setPaymentMethod('paypal')}
                >
                  <span className="payment-modal-provider-mark paypal">P</span>
                  <span>
                    <strong>PayPal</strong>
                    <small>Pay securely with your PayPal account</small>
                  </span>
                  <span className="payment-modal-check">{paymentMethod === 'paypal' ? '✓' : ''}</span>
                </button>
              </div>

              <div className="payment-modal-note">
                Your selected payment service will process the booking. After successful payment,
                BookingModel will create the invoice and show it on the confirmation page.
              </div>

              {error && <div className="alert alert-error" role="alert">{error}</div>}
            </div>

            <div className="modal-foot payment-modal-foot">
              <button className="btn-ghost" type="button" onClick={closePaymentModal} disabled={submitting}>
                Cancel
              </button>
              <button className="btn-solid payment-modal-confirm" type="button" onClick={confirmPayment} disabled={submitting}>
                {submitting ? <><span className="spinner" /> Processing…</> : `Pay ${money(price.total)} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
