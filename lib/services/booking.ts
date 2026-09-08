import 'server-only';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { paymentProvider, priceBooking, type PaymentMethod } from '@/lib/payments';
import {
  adminBookingRequestEmail,
  adminNewBookingEmail,
  bookingConfirmedEmail,
  leadAcknowledgementEmail,
  sendAll,
} from '@/lib/email';
import type { BookingRequest, Creator, Deal, Invoice, Plan } from '@/lib/types';
import { unitPriceFor } from '@/lib/utils';
import { nextDealRef, nextInvoiceNo, nextRequestRef } from './refs';
import { sendCreatorBookingInvite } from './creator-booking';

/**
 * The booking pipeline.
 *
 *   US / CA visitor  -> createPaidBooking(): charge, deal, invoice, 3 e-mails
 *   everyone else    -> createBookingRequest(): lead row + 2 e-mails
 *
 * Callers MUST have run `assertCanTransact()` before createPaidBooking — this
 * module records `origin_country` but does not re-run the gate, so that the
 * admin can also create a booking on behalf of a restricted-region brand.
 */

export interface BookingInput {
  creatorId: string;
  campaignId?: string | null;
  quantity: number;
  contentType: string;
  deliverables?: string | null;
  brief?: string | null;
  dueDate?: string | null;
  brandId?: string | null;
  brandName: string;
  brandEmail: string;
  originCountry?: string | null;
  /**
   * Subscription plan of the signed-in brand, resolved server-side. It sets the
   * platform fee tier, so it must never be taken from the request body.
   */
  brandPlan?: Plan | null;
  paymentMethod?: PaymentMethod;
  paymentToken?: string | null;
  billing?: {
    company?: string | null;
    address?: string | null;
  };
}

export interface BookingSuccess {
  ok: true;
  deal: Deal;
  invoice: Invoice;
  creator: Creator;
  payment: { provider: string; ref: string | null; last4?: string | null; brand?: string | null };
  notifications: { creatorEmailed: boolean; brandEmailed: boolean };
}

export interface BookingFailure {
  ok: false;
  error: string;
  code: 'CREATOR_NOT_FOUND' | 'CREATOR_INACTIVE' | 'INVALID_INPUT' | 'PAYMENT_FAILED' | 'PAYMENT_ACTION_REQUIRED';
  clientSecret?: string | null;
}

export async function createPaidBooking(
  input: BookingInput,
): Promise<BookingSuccess | BookingFailure> {
  const creator = await db.get('creators', input.creatorId);
  if (!creator) return { ok: false, error: 'Creator not found.', code: 'CREATOR_NOT_FOUND' };
  if (creator.status !== 'active') {
    return { ok: false, error: 'This creator is not accepting bookings right now.', code: 'CREATOR_INACTIVE' };
  }
  if (!input.brandEmail || !input.contentType) {
    return { ok: false, error: 'Missing required booking details.', code: 'INVALID_INPUT' };
  }

  const price = priceBooking(unitPriceFor(creator), input.quantity, input.brandPlan ?? 'free');
  if (price.total <= 0) {
    return { ok: false, error: 'This creator has no published rate — please contact us for a quote.', code: 'INVALID_INPUT' };
  }

  const dealRef = await nextDealRef();
  const provider = paymentProvider(input.paymentMethod);

  const charge = await provider.charge({
    amountUsd: price.total,
    reference: dealRef,
    description: `${price.quantity}x ${input.contentType} — ${creator.name} (${creator.handle})`,
    customerEmail: input.brandEmail,
    customerName: input.brandName,
    token: input.paymentToken ?? null,
    metadata: { creator_id: creator.id, creator_handle: creator.handle },
  });

  if (!charge.ok) {
    return { ok: false, error: charge.error ?? 'Payment failed.', code: 'PAYMENT_FAILED' };
  }

  // Stripe path: the browser still has to confirm the PaymentIntent.
  if (charge.status === 'requires_action') {
    return {
      ok: false,
      error: 'Additional confirmation is required to complete this payment.',
      code: 'PAYMENT_ACTION_REQUIRED',
      clientSecret: charge.clientSecret ?? null,
    };
  }

  const now = new Date().toISOString();
  const dueDate =
    input.dueDate ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const deal = await db.insert('deals', {
    deal_ref: dealRef,
    campaign_id: input.campaignId ?? null,
    creator_id: creator.id,
    brand_id: input.brandId ?? null,
    brand_name: input.brandName,
    brand_email: input.brandEmail,
    content_type: input.contentType,
    deliverables: input.deliverables ?? `${price.quantity}x ${input.contentType}`,
    quantity: price.quantity,
    unit_price_usd: price.unitPrice,
    subtotal_usd: price.subtotal,
    platform_fee_usd: price.platformFee,
    platform_fee_percent: price.feePercent,
    tax_usd: price.tax,
    total_usd: price.total,
    currency: 'USD',
    status: 'brief_sent',
    payment_status: 'paid',
    payment_provider: charge.provider,
    payment_ref: charge.paymentRef,
    due_date: dueDate,
    brief: input.brief ?? null,
    notes: null,
    origin_country: input.originCountry ?? null,
    creator_notified_at: null,
    creator_response_status: 'pending',
    creator_response_token_hash: null,
    creator_response_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    creator_responded_at: null,
    refund_status: 'not_required',
    refund_reason: null,
    refunded_at: null,
    payout_status: 'not_due',
    payout_ref: null,
    created_at: now,
    updated_at: now,
  });

  const invoice = await db.insert('invoices', {
    invoice_no: await nextInvoiceNo(),
    deal_id: deal.id,
    brand_id: input.brandId ?? null,
    bill_to_name: input.brandName,
    bill_to_email: input.brandEmail,
    bill_to_company: input.billing?.company ?? input.brandName,
    bill_to_address: input.billing?.address ?? null,
    subtotal_usd: price.subtotal,
    platform_fee_usd: price.platformFee,
    platform_fee_percent: price.feePercent,
    tax_usd: price.tax,
    total_usd: price.total,
    currency: 'USD',
    status: 'paid',
    issued_at: now,
    paid_at: now,
    payment_provider: charge.provider,
    payment_ref: charge.paymentRef,
    created_at: now,
  });

  // The creator receives a one-time accept/decline link. The brand and admin
  // receive their own notifications. Delivery never rolls back a paid deal.
  const creatorInvite = await sendCreatorBookingInvite(deal.id);
  const results = await sendAll(
    [
      bookingConfirmedEmail(deal, creator, invoice),
      adminNewBookingEmail(deal, creator),
    ],
    { type: 'deal', id: deal.id },
  );
  const refreshedDeal = await db.get('deals', deal.id);

  return {
    ok: true,
    deal: refreshedDeal ?? deal,
    invoice,
    creator,
    payment: {
      provider: charge.provider,
      ref: charge.paymentRef,
      last4: charge.last4 ?? null,
      brand: charge.brand ?? null,
    },
    notifications: { creatorEmailed: creatorInvite.ok, brandEmailed: results[0]?.ok ?? false },
  };
}

// ---------------------------------------------------------------------------
// Requirement #2 — restricted-region lead capture
// ---------------------------------------------------------------------------

export interface BookingRequestInput {
  creatorId?: string | null;
  campaignId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  preferredContact?: string | null;
  budget?: string | null;
  contentType?: string | null;
  quantity?: number | null;
  message?: string | null;
  country?: string | null;
  regionBlocked: boolean;
}

export async function createBookingRequest(
  input: BookingRequestInput,
): Promise<{ ok: true; request: BookingRequest } | { ok: false; error: string }> {
  if (!input.fullName?.trim() || !input.email?.trim()) {
    return { ok: false, error: 'Name and email are required.' };
  }

  let creatorName: string | null = null;
  if (input.creatorId) {
    const creator = await db.get('creators', input.creatorId);
    creatorName = creator ? `${creator.name} (${creator.handle})` : null;
  }

  const request = await db.insert('booking_requests', {
    request_ref: await nextRequestRef(),
    creator_id: input.creatorId ?? null,
    creator_name: creatorName,
    campaign_id: input.campaignId ?? null,
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? null,
    company: input.company ?? null,
    website: input.website ?? null,
    preferred_contact: input.preferredContact ?? 'email',
    budget: input.budget ?? null,
    content_type: input.contentType ?? null,
    quantity: input.quantity ?? null,
    message: input.message ?? null,
    country: input.country ?? null,
    region_blocked: input.regionBlocked,
    status: 'new',
    admin_notes: null,
    handled_by: null,
    created_at: new Date().toISOString(),
  });

  await sendAll([adminBookingRequestEmail(request), leadAcknowledgementEmail(request)], {
    type: 'booking_request',
    id: request.id,
  });

  return { ok: true, request };
}

/** Contact block shown in the restricted-region modal. */
export function managerContact() {
  return {
    name: config.manager.name,
    email: config.manager.email,
    phone: config.manager.phone,
    whatsapp: config.manager.whatsapp,
    hours: config.manager.hours,
  };
}
