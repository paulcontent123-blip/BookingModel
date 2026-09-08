'use client';

import { useEffect, useState } from 'react';
import { countryFlag, countryName } from '@/lib/geo';
import { useGeo } from './geo-provider';

/**
 * Requirement #2
 * ---------------------------------------------------------------------------
 * A visitor whose IP is outside PAYMENT_ALLOWED_COUNTRIES cannot check out.
 * Instead of a dead end they get this modal: the account manager's real contact
 * details, plus a form whose submission is stored in `booking_requests` and
 * e-mailed to the team (and acknowledged back to the visitor).
 */

const BUDGETS = [
  'Under $3,000',
  '$3,000 – $10,000',
  '$10,000 – $30,000',
  '$30,000+',
  'Not sure yet',
];

const CONTENT_TYPES = [
  'UGC Video (30s)',
  'UGC Video (60s)',
  'Testimonial',
  'Unboxing',
  'Product Demo',
  'Livestream Segment',
  'Full campaign — need advice',
];

export function RestrictedRegionModal() {
  const { geo, manager, restrictedOpen, closeRestricted, prefill } = useGeo();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restrictedOpen) {
      setDone(null);
      setError(null);
    }
  }, [restrictedOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRestricted();
    if (restrictedOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restrictedOpen, closeRestricted]);

  if (!restrictedOpen) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch('/api/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          creatorId: prefill.creatorId ?? null,
          campaignId: prefill.campaignId ?? null,
          quantity: payload.quantity ? Number(payload.quantity) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not submit your request.');
      setDone({ ref: data.request_ref });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please email us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-wrap open" onClick={(e) => e.target === e.currentTarget && closeRestricted()}>
      <div className="modal-box rr-modal">
        <div className="modal-head">
          <div className="modal-title">
            {done ? 'Request received' : 'Booking assistance required'}
          </div>
          <button className="modal-close" onClick={closeRestricted} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {done ? (
            <>
              <div className="alert alert-ok" style={{ marginBottom: 16 }}>
                <strong>Thank you — your reference is {done.ref}.</strong>
                <br />
                We emailed a copy to you. {manager.name} will get in touch within one business day.
              </div>
              <ContactBlock manager={manager} />
              <button className="submit-btn" onClick={closeRestricted}>Close</button>
            </>
          ) : (
            <>
              <div className="rr-alert">
                <strong>
                  {countryFlag(geo.country)} Online checkout is not available in{' '}
                  {countryName(geo.country)}.
                </strong>
                <br />
                You can browse creators and rates freely, but payments are processed for
                US-based brands only. Leave your details below and our account manager will set
                the booking up with you directly — same creators, same rates.
              </div>

              <ContactBlock manager={manager} />

              {prefill.creatorName && (
                <div className="alert alert-info" style={{ marginBottom: 14 }}>
                  Requesting: <strong>{prefill.creatorName}</strong>
                </div>
              )}

              {error && <div className="alert alert-error">{error}</div>}

              <form onSubmit={onSubmit}>
                <div className="fg2">
                  <div className="fg">
                    <label htmlFor="rr-name">Full name *</label>
                    <input id="rr-name" name="fullName" required placeholder="Nguyen Van A" />
                  </div>
                  <div className="fg">
                    <label htmlFor="rr-email">Email *</label>
                    <input id="rr-email" name="email" type="email" required placeholder="you@company.com" />
                  </div>
                </div>

                <div className="fg2">
                  <div className="fg">
                    <label htmlFor="rr-phone">Phone / WhatsApp / Zalo</label>
                    <input id="rr-phone" name="phone" placeholder="+84 ..." />
                  </div>
                  <div className="fg">
                    <label htmlFor="rr-company">Company / Brand</label>
                    <input id="rr-company" name="company" placeholder="Your brand" />
                  </div>
                </div>

                <div className="fg2">
                  <div className="fg">
                    <label htmlFor="rr-contact-pref">Preferred contact</label>
                    <select id="rr-contact-pref" name="preferredContact" defaultValue="email">
                      <option value="email">Email</option>
                      <option value="phone">Phone call</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="zalo">Zalo</option>
                      <option value="telegram">Telegram</option>
                    </select>
                  </div>
                  <div className="fg">
                    <label htmlFor="rr-budget">Budget (USD)</label>
                    <select id="rr-budget" name="budget" defaultValue="">
                      <option value="">Select a range</option>
                      {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className="fg2">
                  <div className="fg">
                    <label htmlFor="rr-type">Content type</label>
                    <select
                      id="rr-type"
                      name="contentType"
                      defaultValue={prefill.contentType ?? ''}
                    >
                      <option value="">Select</option>
                      {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="fg">
                    <label htmlFor="rr-qty">Number of videos</label>
                    <input
                      id="rr-qty"
                      name="quantity"
                      type="number"
                      min={1}
                      max={200}
                      defaultValue={prefill.quantity ?? 1}
                    />
                  </div>
                </div>

                <div className="fg">
                  <label htmlFor="rr-website">Website / Store URL</label>
                  <input id="rr-website" name="website" placeholder="https://" />
                </div>

                <div className="fg">
                  <label htmlFor="rr-message">Tell us about your campaign</label>
                  <textarea
                    id="rr-message"
                    name="message"
                    rows={3}
                    placeholder="Product, target audience, timeline, anything else we should know."
                  />
                </div>

                <button className="submit-btn" type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send request →'}
                </button>
                <p className="summary-note" style={{ textAlign: 'center' }}>
                  We reply within one business day. No payment is taken on this form.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactBlock({ manager }: { manager: ReturnType<typeof useGeo>['manager'] }) {
  return (
    <div className="rr-contact">
      <div className="rr-contact-title">Talk to us directly</div>
      <div className="rr-contact-row"><span>👤</span><span>{manager.name}</span></div>
      <div className="rr-contact-row">
        <span>✉️</span><a href={`mailto:${manager.email}`}>{manager.email}</a>
      </div>
      <div className="rr-contact-row">
        <span>📞</span><a href={`tel:${manager.phone.replace(/[^\d+]/g, '')}`}>{manager.phone}</a>
      </div>
      <div className="rr-contact-row">
        <span>💬</span>
        <a
          href={`https://wa.me/${manager.whatsapp.replace(/[^\d]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp / Zalo {manager.whatsapp}
        </a>
      </div>
      <div className="rr-contact-row"><span>🕘</span><span>{manager.hours}</span></div>
    </div>
  );
}
