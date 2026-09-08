import 'server-only';

import crypto from 'node:crypto';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import {
  adminCreatorResponseEmail,
  bookingRefundedEmail,
  creatorAcceptedEmail,
  creatorBookedEmail,
  sendAll,
  sendEmail,
} from '@/lib/email';
import { paymentProvider } from '@/lib/payments';
import type { Creator, Deal, Invoice, RefundStatus } from '@/lib/types';

export const CREATOR_RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;

type CreatorDecision = 'accept' | 'decline';
type FailureReason = 'declined' | 'expired';

export interface CreatorBookingActionResult {
  ok: boolean;
  status: 'accepted' | 'declined' | 'expired' | 'refunded' | 'invalid' | 'already_handled';
  message: string;
  refundOk?: boolean;
}

function responseStatus(deal: Deal): Deal['creator_response_status'] {
  // Legacy deals created before this workflow existed are treated as already
  // handled. New bookings always set the field explicitly.
  return deal.creator_response_status ?? 'accepted';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tokenMatches(storedHash: string | null | undefined, token: string): boolean {
  if (!storedHash || !token) return false;
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function responseUrl(dealRef: string, decision: CreatorDecision, token: string): string {
  const base = config.site.url.replace(/\/$/, '');
  return `${base}/api/creator-bookings/${encodeURIComponent(dealRef)}/respond?decision=${decision}&token=${token}`;
}

async function relatedBooking(dealId: string): Promise<{
  deal: Deal;
  creator: Creator;
  invoice: Invoice;
} | null> {
  const deal = await db.get('deals', dealId);
  if (!deal) return null;
  const [creator, invoice] = await Promise.all([
    db.get('creators', deal.creator_id),
    db.findOne('invoices', { deal_id: deal.id }),
  ]);
  if (!creator || !invoice) return null;
  return { deal, creator, invoice };
}

/**
 * Creates a one-time response token and sends the creator invite. Only the
 * SHA-256 hash is stored, so a database reader cannot accept a booking using
 * the stored value directly.
 */
export async function sendCreatorBookingInvite(dealId: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const related = await relatedBooking(dealId);
  if (!related) return { ok: false, message: 'Booking, creator, or invoice not found.' };

  const { deal, creator, invoice } = related;
  const current = responseStatus(deal);
  if (current !== 'pending' || deal.payment_status === 'refunded' || deal.status === 'cancelled') {
    return { ok: false, message: `This booking is already ${current} and cannot receive another response.` };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CREATOR_RESPONSE_WINDOW_MS).toISOString();
  const prepared = await db.update('deals', deal.id, {
    creator_response_status: 'pending',
    creator_response_token_hash: hashToken(token),
    creator_response_expires_at: expiresAt,
    creator_responded_at: null,
    refund_status: deal.refund_status ?? 'not_required',
    updated_at: new Date().toISOString(),
  });
  if (!prepared) return { ok: false, message: 'Booking could not be prepared for creator response.' };

  const result = await sendEmail(
    creatorBookedEmail(prepared, creator, invoice, {
      acceptUrl: responseUrl(deal.deal_ref, 'accept', token),
      declineUrl: responseUrl(deal.deal_ref, 'decline', token),
    }),
    { type: 'deal', id: deal.id },
  );

  if (!result.ok) return { ok: false, message: result.error ?? 'Creator email could not be sent.' };

  await db.update('deals', deal.id, {
    creator_notified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return { ok: true, message: `Booking invite sent to ${creator.contact_email ?? config.email.adminEmail}.` };
}

async function refundBookingPayment(deal: Deal): Promise<{ ok: boolean; error?: string }> {
  if (deal.payment_status === 'refunded' || deal.refund_status === 'refunded') {
    return { ok: true };
  }

  await db.update('deals', deal.id, {
    refund_status: 'pending',
    updated_at: new Date().toISOString(),
  });

  if (!deal.payment_ref) {
    const error = 'No payment reference is stored for this booking.';
    await db.update('deals', deal.id, {
      refund_status: 'failed',
      updated_at: new Date().toISOString(),
    });
    return { ok: false, error };
  }

  // The provider is selected from the provider used for the original charge.
  // PayPal currently falls back to the local provider until its adapter is
  // configured; Stripe uses the real refund endpoint when its secret exists.
  const provider = deal.payment_provider === 'stripe'
    ? paymentProvider('stripe')
    : paymentProvider('paypal');

  try {
    const result = await provider.refund(deal.payment_ref, deal.total_usd);
    if (!result.ok) {
      await db.update('deals', deal.id, {
        refund_status: 'failed',
        updated_at: new Date().toISOString(),
      });
      return { ok: false, error: result.error ?? 'The payment provider rejected the refund.' };
    }

    const refundedAt = new Date().toISOString();
    await db.update('deals', deal.id, {
      payment_status: 'refunded',
      refund_status: 'refunded',
      refunded_at: refundedAt,
      updated_at: refundedAt,
    });
    const invoice = await db.findOne('invoices', { deal_id: deal.id });
    if (invoice) {
      await db.update('invoices', invoice.id, { status: 'refunded' });
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update('deals', deal.id, {
      refund_status: 'failed',
      updated_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }
}

async function finalizeFailure(
  deal: Deal,
  reason: FailureReason,
): Promise<CreatorBookingActionResult> {
  const now = new Date().toISOString();
  const current = responseStatus(deal);
  if (current !== 'pending') {
    return {
      ok: false,
      status: 'already_handled',
      message: `This booking was already ${current}.`,
      refundOk: deal.payment_status === 'refunded',
    };
  }

  // Mark the response before calling the provider. A repeated click or a
  // second cron worker cannot start another refund for the same invite.
  const marked = await db.update('deals', deal.id, {
    creator_response_status: reason,
    creator_response_token_hash: null,
    creator_responded_at: now,
    refund_status: 'pending',
    refund_reason: reason,
    status: 'cancelled',
    payout_status: 'not_due',
    updated_at: now,
  });
  if (!marked) {
    return { ok: false, status: reason, message: 'Booking could not be updated.' };
  }

  const refund = await refundBookingPayment(marked);
  const updatedDeal = await db.get('deals', deal.id);
  const related = await relatedBooking(deal.id);
  if (updatedDeal && related) {
    await sendAll([
      bookingRefundedEmail(updatedDeal, related.creator, related.invoice, reason, refund.ok),
      adminCreatorResponseEmail(updatedDeal, related.creator, reason, refund.ok),
    ], { type: 'deal', id: deal.id });
  }

  return {
    ok: refund.ok,
    status: reason,
    message: refund.ok
      ? reason === 'declined'
        ? 'Booking declined and the brand payment was refunded.'
        : 'Booking expired and the brand payment was refunded.'
      : `Booking was closed, but the refund needs admin review: ${refund.error ?? 'unknown error'}`,
    refundOk: refund.ok,
  };
}

export async function respondToCreatorBooking(
  dealRef: string,
  token: string,
  decision: CreatorDecision,
): Promise<CreatorBookingActionResult> {
  const deal = await db.findOne('deals', { deal_ref: dealRef });
  if (!deal || !tokenMatches(deal.creator_response_token_hash, token)) {
    return { ok: false, status: 'invalid', message: 'This booking response link is invalid or has expired.' };
  }

  const current = responseStatus(deal);
  if (current !== 'pending') {
    return {
      ok: false,
      status: 'already_handled',
      message: `This booking was already ${current}.`,
      refundOk: deal.payment_status === 'refunded',
    };
  }

  if (deal.creator_response_expires_at && Date.parse(deal.creator_response_expires_at) <= Date.now()) {
    return finalizeFailure(deal, 'expired');
  }

  if (decision === 'decline') return finalizeFailure(deal, 'declined');

  const now = new Date().toISOString();
  const accepted = await db.update('deals', deal.id, {
    creator_response_status: 'accepted',
    creator_response_token_hash: null,
    creator_responded_at: now,
    payout_status: 'pending',
    refund_status: 'not_required',
    status: 'brief_sent',
    updated_at: now,
  });
  if (!accepted) return { ok: false, status: 'accepted', message: 'Booking could not be accepted.' };

  const related = await relatedBooking(deal.id);
  if (related) {
    await sendAll([
      creatorAcceptedEmail(accepted, related.creator),
      adminCreatorResponseEmail(accepted, related.creator, 'accepted'),
    ], { type: 'deal', id: deal.id });
  }

  return { ok: true, status: 'accepted', message: 'Booking accepted. The brand has been notified.' };
}

/** Called by the cron endpoint and by admin pages as a local/dev fallback. */
export async function expirePendingCreatorBookings(): Promise<{
  processed: number;
  refunded: number;
  needsReview: number;
}> {
  const now = new Date().toISOString();
  const pending = await db.list('deals', {
    filters: [
      { column: 'creator_response_status', op: 'eq', value: 'pending' },
      { column: 'creator_response_expires_at', op: 'lte', value: now },
    ],
    limit: 1000,
  });

  let refunded = 0;
  let needsReview = 0;
  for (const deal of pending) {
    const result = await finalizeFailure(deal, 'expired');
    if (result.refundOk) refunded += 1;
    else needsReview += 1;
  }
  return { processed: pending.length, refunded, needsReview };
}

/** Manual retry used by the admin refund queue after a provider outage. */
export async function retryBookingRefund(dealId: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const related = await relatedBooking(dealId);
  if (!related) return { ok: false, message: 'Booking, creator, or invoice not found.' };
  if (related.deal.payment_status === 'refunded') {
    return { ok: true, message: 'This booking has already been refunded.' };
  }
  if (related.deal.refund_status !== ('failed' as RefundStatus)) {
    return { ok: false, message: 'This booking is not waiting for a refund retry.' };
  }

  const result = await refundBookingPayment(related.deal);
  const updated = await db.get('deals', dealId);
  if (result.ok && updated) {
    const reason = updated.creator_response_status === 'expired' ? 'expired' : 'declined';
    await sendAll([
      bookingRefundedEmail(updated, related.creator, related.invoice, reason, true),
      adminCreatorResponseEmail(updated, related.creator, reason, true),
    ], { type: 'deal', id: dealId });
  }
  return {
    ok: result.ok,
    message: result.ok
      ? 'Refund completed and the brand was notified.'
      : `Refund still failed: ${result.error ?? 'unknown error'}`,
  };
}
