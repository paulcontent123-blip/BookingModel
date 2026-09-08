'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTENT_TYPES, money } from '@/lib/utils';
import { useGeo } from './geo-provider';

/**
 * Requirement #3 — US brands book and pay here.
 *
 * Card fields are collected in a provider-agnostic shape. With the mock
 * provider nothing leaves the server; when Stripe is switched on, replace the
 * `card` block with Stripe Elements — everything else stays.
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
  payment: { provider: string; isLive: boolean; feePercent: number; taxPercent: number };
  country: string | null;
}) {
  const router = useRouter();
  const { openRestricted } = useGeo();

  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = useMemo(() => {
    const subtotal = creator.unitPrice * quantity;
    const platformFee = Math.round((subtotal * payment.feePercent) / 100);
    const tax = Math.round(((subtotal + platformFee) * payment.taxPercent) / 100);
    return { subtotal, platformFee, tax, total: subtotal + platformFee + tax };
  }, [creator.unitPrice, quantity, payment.feePercent, payment.taxPercent]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      paymentToken: String(form.get('cardNumber') ?? '').replace(/\s/g, ''),
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
    <form className="book-grid" onSubmit={onSubmit}>
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

        <div className="form-box">
          <div className="form-title">
            3. Payment
            <span className={`pay-badge ${payment.isLive ? '' : 'test'}`} style={{ float: 'right' }}>
              {payment.isLive ? `${payment.provider} · live` : `${payment.provider} · test mode`}
            </span>
          </div>

          {!payment.isLive && (
            <div className="alert alert-warn">
              <strong>Test mode.</strong> No payment provider is connected yet, so no card is
              charged and nothing is sent to a payment network. The booking, invoice and creator
              notification are all created for real. Any card number works; one ending in{' '}
              <code>0000</code> simulates a decline.
            </div>
          )}

          <div className="fg">
            <label htmlFor="cardName">Name on card *</label>
            <input id="cardName" name="cardName" required placeholder="JANE DOE" />
          </div>
          <div className="fg">
            <label htmlFor="cardNumber">Card number *</label>
            <input
              id="cardNumber"
              name="cardNumber"
              required
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
              defaultValue={payment.isLive ? '' : '4242 4242 4242 4242'}
            />
          </div>
          <div className="fg2">
            <div className="fg">
              <label htmlFor="cardExp">Expiry *</label>
              <input id="cardExp" name="cardExp" required placeholder="12/28" defaultValue={payment.isLive ? '' : '12/28'} />
            </div>
            <div className="fg">
              <label htmlFor="cardCvc">CVC *</label>
              <input id="cardCvc" name="cardCvc" required placeholder="123" defaultValue={payment.isLive ? '' : '123'} />
            </div>
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

        <button className="submit-btn" type="submit" disabled={submitting} style={{ marginTop: 14 }}>
          {submitting ? <><span className="spinner" /> Processing…</> : `Pay ${money(price.total)} →`}
        </button>

        <p className="summary-note">
          Paying confirms the booking, issues an invoice and emails{' '}
          <strong>{creator.name}</strong> the brief immediately.
          {country && <> Billing region: {country}.</>}
        </p>
      </aside>
    </form>
  );
}
