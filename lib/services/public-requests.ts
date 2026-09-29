import 'server-only';

import { config } from '@/lib/config';
import { db } from '@/lib/db';
import {
  adminNewApplicantEmail,
  adminPartnershipEmail,
  applicantReceivedEmail,
  sendAll,
  sendEmail,
} from '@/lib/email';
import type { PublicRequestType } from '@/lib/types';
import { normalizeHandle } from '@/lib/utils';
import { createBookingRequest } from './booking';
import {
  applicantPendingPayloadSchema,
  bookingPendingPayloadSchema,
  contactPendingPayloadSchema,
  partnershipPendingPayloadSchema,
  type ApplicantRequestInput,
  type ContactRequestInput,
  type PartnershipRequestInput,
} from './public-request-schemas';

const esc = (s: unknown) =>
  String(s ?? '—').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);

export type PersistedPublicRequest =
  | { ok: true; id: string; request_ref?: string }
  | { ok: false; error: string };

type ApplicantCampaignCheck =
  | { ok: true; campaignId: string | null }
  | { ok: false; error: string };

export async function persistContactRequest(
  input: ContactRequestInput & { country?: string | null },
): Promise<PersistedPublicRequest> {
  const email = input.email.trim().toLowerCase();
  const message = await db.insert('contact_messages', {
    first_name: input.first_name ?? null,
    last_name: input.last_name ?? null,
    email,
    company: input.company ?? null,
    inquiry_type: input.inquiry_type ?? null,
    budget: input.budget ?? null,
    message: input.message ?? null,
    country: input.country ?? null,
    status: 'new',
    created_at: new Date().toISOString(),
  });

  await sendEmail(
    {
      to: config.email.salesEmail,
      template: 'admin_contact_message',
      subject: `[Inquiry${input.country ? ` · ${input.country}` : ''}] ${input.inquiry_type ?? 'General'} — ${input.company ?? email}`,
      html: `<h2>New inquiry from the website</h2>
        <p><strong>Name:</strong> ${esc(`${input.first_name ?? ''} ${input.last_name ?? ''}`.trim())}<br>
        <strong>Email:</strong> ${esc(email)}<br>
        <strong>Company:</strong> ${esc(input.company)}<br>
        <strong>Type:</strong> ${esc(input.inquiry_type)}<br>
        <strong>Budget:</strong> ${esc(input.budget)}<br>
        <strong>Country:</strong> ${esc(input.country)}</p>
        <p><strong>Message</strong><br>${esc(input.message).replace(/\n/g, '<br>')}</p>`,
    },
    { type: 'contact_message', id: message.id },
  );

  return { ok: true, id: message.id };
}

export async function persistPartnershipRequest(
  input: PartnershipRequestInput & { country?: string | null },
): Promise<PersistedPublicRequest> {
  const request = await db.insert('partnership_requests', {
    name: input.name,
    company: input.company ?? null,
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? null,
    type: input.type,
    budget: input.budget ?? null,
    description: input.description,
    status: 'new',
    assigned_to: null,
    source: 'website',
    country: input.country ?? null,
    created_at: new Date().toISOString(),
  });

  await sendEmail(adminPartnershipEmail(request), { type: 'partnership_request', id: request.id });

  return { ok: true, id: request.id };
}

export async function assertApplicantCampaign(campaignId?: string): Promise<ApplicantCampaignCheck> {
  if (!campaignId) return { ok: true, campaignId: null };

  const campaign = await db.get('campaigns', campaignId);
  const spotsAvailable = campaign && campaign.spots_filled < campaign.spots_total;
  if (!campaign || campaign.status !== 'active' || !spotsAvailable) {
    return { ok: false, error: 'This campaign is no longer accepting applications.' };
  }

  return { ok: true, campaignId: campaign.id };
}

export async function persistApplicantRequest(
  input: ApplicantRequestInput & { country?: string | null },
): Promise<PersistedPublicRequest> {
  const campaignCheck = await assertApplicantCampaign(input.campaign_id);
  if (!campaignCheck.ok) return campaignCheck;

  const applicant = await db.insert('applicants', {
    campaign_id: campaignCheck.campaignId,
    name: input.name,
    handle: normalizeHandle(input.handle),
    platform: input.platform,
    channel_url: input.channel_url,
    niche: input.niche,
    audience: input.audience ?? null,
    er: input.er ?? null,
    rate: input.rate ?? null,
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? null,
    photo_url: input.photo_url ?? null,
    video_url: input.video_url ?? null,
    notes: input.notes ?? null,
    status: 'pending',
    admin_notes: null,
    creator_id: null,
    country: input.country ?? null,
    applied_at: new Date().toISOString(),
  });

  await sendAll([applicantReceivedEmail(applicant), adminNewApplicantEmail(applicant)], {
    type: 'applicant',
    id: applicant.id,
  });

  return { ok: true, id: applicant.id };
}

/**
 * Re-validates and persists a request after its email verification code is
 * accepted. The payload was created server-side, but it is still parsed again
 * so this boundary cannot write an unexpected shape into the database.
 */
export async function persistVerifiedPublicRequest(
  type: PublicRequestType,
  payload: Record<string, unknown>,
): Promise<PersistedPublicRequest> {
  switch (type) {
    case 'contact': {
      const parsed = contactPendingPayloadSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, error: 'This request has expired. Please submit it again.' };
      return persistContactRequest(parsed.data);
    }
    case 'partnership': {
      const parsed = partnershipPendingPayloadSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, error: 'This request has expired. Please submit it again.' };
      return persistPartnershipRequest(parsed.data);
    }
    case 'applicant': {
      const parsed = applicantPendingPayloadSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, error: 'This application has expired. Please submit it again.' };
      return persistApplicantRequest(parsed.data);
    }
    case 'booking_request': {
      const parsed = bookingPendingPayloadSchema.safeParse(payload);
      if (!parsed.success) return { ok: false, error: 'This request has expired. Please submit it again.' };
      const result = await createBookingRequest({
        creatorId: parsed.data.creatorId ?? null,
        campaignId: parsed.data.campaignId ?? null,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        company: parsed.data.company ?? null,
        website: parsed.data.website ?? null,
        preferredContact: parsed.data.preferredContact ?? 'email',
        budget: parsed.data.budget ?? null,
        contentType: parsed.data.contentType ?? null,
        quantity: parsed.data.quantity ?? null,
        message: parsed.data.message ?? null,
        country: parsed.data.country ?? null,
        regionBlocked: parsed.data.regionBlocked,
      });
      return result.ok
        ? { ok: true, id: result.request.id, request_ref: result.request.request_ref }
        : result;
    }
  }
}
