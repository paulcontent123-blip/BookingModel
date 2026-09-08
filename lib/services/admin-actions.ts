'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import {
  applicantDecisionEmail,
  brandPlanChangedEmail,
  creatorBookedEmail,
  sendEmail,
} from '@/lib/email';
import { isPlan, planName } from '@/lib/plans';
import type { ApplicantStatus, BookingRequestStatus, Creator, DealStatus } from '@/lib/types';
import { validateCreatorInput } from '@/lib/creator-validation';
import { CloudinaryError, deleteCloudinaryImage } from '@/lib/cloudinary';
import { normalizeHandle, parseAudience, parseRateRange, tierFor } from '@/lib/utils';

/**
 * Server actions behind the admin UI. Every one re-checks the admin role —
 * a server action is a public endpoint, not a trusted internal call.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

function creatorValidationError(formData: FormData): string | null {
  return validateCreatorInput({
    name: String(formData.get('name') ?? ''),
    handle: String(formData.get('handle') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    channelUrl: String(formData.get('channel_url') ?? ''),
    category: String(formData.get('category') ?? ''),
    audience: String(formData.get('audience') ?? ''),
    er: String(formData.get('er') ?? ''),
    rate: String(formData.get('rate') ?? ''),
    contactEmail: String(formData.get('contact_email') ?? ''),
    photoUrl: String(formData.get('photo_url') ?? ''),
    videoUrl: String(formData.get('video_url') ?? ''),
    status: String(formData.get('status') ?? 'active'),
  });
}

// ── Creators (requirement #4: the roster is curated by the admin) ───────────

export async function createCreatorAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const handleRaw = String(formData.get('handle') ?? '').trim();
  const platform = String(formData.get('platform') ?? '').trim();

  const validationError = creatorValidationError(formData);
  if (validationError) return { ok: false, message: validationError };

  const handle = normalizeHandle(handleRaw);

  try {
    const creators = await db.list('creators', { limit: 10000 });
    const duplicate = creators.find((creator) => creator.handle.toLowerCase() === handle.toLowerCase());
    if (duplicate) return { ok: false, message: `${handle} is already in the database.` };

    const audience = String(formData.get('audience') ?? '').trim() || null;
    const rate = parseRateRange(String(formData.get('rate') ?? ''));
    const audienceCount = parseAudience(audience);
    const contactEmail = String(formData.get('contact_email') ?? '').trim() || null;
    const now = new Date().toISOString();

    const creator = await db.insert('creators', {
      legacy_id: null,
      user_id: null,
      name,
      handle,
      platform,
      channel_url: String(formData.get('channel_url') ?? '').trim() || null,
      niche: String(formData.get('niche') ?? '').trim() || null,
      category: String(formData.get('category') ?? '').trim() || null,
      tier: tierFor(audienceCount),
      audience,
      audience_count: audienceCount,
      er: String(formData.get('er') ?? '').trim() || null,
      rate_min: rate.min,
      rate_max: rate.max,
      contact_email: contactEmail,
      contact_hint: String(formData.get('contact_hint') ?? '').trim() || null,
      contact_verified: formData.get('contact_verified') === 'on',
      bd_notes: String(formData.get('bd_notes') ?? '').trim() || null,
      bio: String(formData.get('bio') ?? '').trim() || null,
      photo_url: String(formData.get('photo_url') ?? '').trim() || null,
      avatar_url: null,
      accent_bg: '#F2F2F2',
      emoji: String(formData.get('emoji') ?? '').trim() || '👤',
      status: (String(formData.get('status') ?? 'active') as Creator['status']) || 'active',
      source: 'manual',
      import_batch_id: null,
      created_at: now,
      updated_at: now,
    });

    const videoUrl = String(formData.get('video_url') ?? '').trim();
    if (videoUrl) {
      const { extractYouTubeId } = await import('@/lib/utils');
      const youtubeId = extractYouTubeId(videoUrl);
      await db.insert('creator_portfolio', {
        creator_id: creator.id,
        type: 'video',
        url: videoUrl,
        thumbnail: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
        youtube_id: youtubeId,
        label: 'Portfolio video',
        sort_order: 0,
        created_at: now,
      });
    }

    revalidatePath('/admin/creators');
    revalidatePath('/marketplace');
    return { ok: true, message: `${name} added to the roster.` };
  } catch (error) {
    console.error('[admin/create-creator]', error);
    return {
      ok: false,
      message: 'Creator could not be added. The database rejected the data or is unavailable.',
    };
  }
}

export async function updateCreatorStatusAction(
  id: string,
  status: Creator['status'],
): Promise<ActionResult> {
  await requireAdmin();
  const updated = await db.update('creators', id, { status });
  if (!updated) return { ok: false, message: 'Creator not found.' };

  revalidatePath('/admin/creators');
  revalidatePath('/marketplace');
  return { ok: true, message: `${updated.name} is now ${status}.` };
}

export async function deleteCreatorAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    const creator = await db.get('creators', id);
    if (!creator) return { ok: false, message: 'Creator not found.' };

    const dealCount = await db.count('deals', { creator_id: id });
    if (dealCount > 0) {
      return {
        ok: false,
        message: `${creator.name} cannot be deleted because ${dealCount} booking(s) are linked to this profile. Set the creator to inactive instead.`,
      };
    }

    // Remove the hosted asset before deleting the database record. If
    // Cloudinary rejects the deletion, keep the creator so the admin can retry
    // instead of silently leaving an orphaned image behind.
    await deleteCloudinaryImage(creator.photo_url);

    // Mirror Supabase foreign-key behavior in the local JSON store and avoid
    // leaving orphaned portfolio/reveal/saved-creator rows behind.
    const [portfolio, savedCreators, contactReveals, applicants, bookingRequests] = await Promise.all([
      db.list('creator_portfolio', { where: { creator_id: id } }),
      db.list('saved_creators', { where: { creator_id: id } }),
      db.list('contact_reveals', { where: { creator_id: id } }),
      db.list('applicants', { where: { creator_id: id } }),
      db.list('booking_requests', { where: { creator_id: id } }),
    ]);

    for (const row of portfolio) await db.remove('creator_portfolio', row.id);
    for (const row of savedCreators) await db.remove('saved_creators', row.id);
    for (const row of contactReveals) await db.remove('contact_reveals', row.id);
    for (const row of applicants) await db.update('applicants', row.id, { creator_id: null });
    for (const row of bookingRequests) await db.update('booking_requests', row.id, { creator_id: null });

    await db.remove('creators', id);
    revalidatePath('/admin/creators');
    revalidatePath('/marketplace');
    revalidatePath(`/creators/${id}`);
    return { ok: true, message: `${creator.name} was deleted.` };
  } catch (error) {
    console.error('[admin/delete-creator]', error);
    if (error instanceof CloudinaryError) {
      return {
        ok: false,
        message: `Creator was not deleted because the Cloudinary image could not be removed: ${error.message}`,
      };
    }
    return {
      ok: false,
      message: 'Creator could not be deleted. Please try again or set the creator to inactive.',
    };
  }
}

export async function updateCreatorAction(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const validationError = creatorValidationError(formData);
  if (validationError) return { ok: false, message: validationError };

  try {
  const audience = String(formData.get('audience') ?? '').trim() || null;
  const rate = parseRateRange(String(formData.get('rate') ?? ''));
  const audienceCount = parseAudience(audience);

  const updated = await db.update('creators', id, {
    name: String(formData.get('name') ?? '').trim(),
    platform: String(formData.get('platform') ?? '').trim(),
    channel_url: String(formData.get('channel_url') ?? '').trim() || null,
    niche: String(formData.get('niche') ?? '').trim() || null,
    category: String(formData.get('category') ?? '').trim() || null,
    audience,
    audience_count: audienceCount,
    tier: tierFor(audienceCount),
    er: String(formData.get('er') ?? '').trim() || null,
    rate_min: rate.min,
    rate_max: rate.max,
    contact_email: String(formData.get('contact_email') ?? '').trim() || null,
    contact_hint: String(formData.get('contact_hint') ?? '').trim() || null,
    contact_verified: formData.get('contact_verified') === 'on',
    bd_notes: String(formData.get('bd_notes') ?? '').trim() || null,
    bio: String(formData.get('bio') ?? '').trim() || null,
    photo_url: String(formData.get('photo_url') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'active') as Creator['status'],
    updated_at: new Date().toISOString(),
  });

  if (!updated) return { ok: false, message: 'Creator not found.' };

  revalidatePath('/admin/creators');
  revalidatePath(`/creators/${id}`);
  revalidatePath('/marketplace');
  return { ok: true, message: 'Creator updated.' };
  } catch (error) {
    console.error('[admin/update-creator]', error);
    return {
      ok: false,
      message: 'Creator could not be updated. The database rejected the data or is unavailable.',
    };
  }
}

// ── Applicants ─────────────────────────────────────────────────────────────

export async function decideApplicantAction(
  id: string,
  decision: Exclude<ApplicantStatus, 'pending'>,
  adminNotes?: string,
): Promise<ActionResult> {
  await requireAdmin();

  const applicant = await db.get('applicants', id);
  if (!applicant) return { ok: false, message: 'Applicant not found.' };

  let creatorId = applicant.creator_id;

  if (decision === 'approved' && !creatorId) {
    const handle = normalizeHandle(applicant.handle ?? applicant.name);
    const existing = await db.findOne('creators', { handle });
    if (existing) {
      creatorId = existing.id;
    } else {
      const audienceCount = parseAudience(applicant.audience);
      const rate = parseRateRange(applicant.rate);
      const now = new Date().toISOString();
      const creator = await db.insert('creators', {
        legacy_id: null,
        user_id: null,
        name: applicant.name,
        handle,
        platform: applicant.platform ?? 'TikTok',
        channel_url: applicant.channel_url,
        niche: applicant.niche,
        category: null,
        tier: tierFor(audienceCount),
        audience: applicant.audience,
        audience_count: audienceCount,
        er: applicant.er,
        rate_min: rate.min,
        rate_max: rate.max,
        contact_email: applicant.email,
        contact_hint: 'Provided on application',
        contact_verified: true,
        bd_notes: applicant.notes,
        bio: applicant.notes,
        photo_url: applicant.photo_url,
        avatar_url: null,
        accent_bg: '#F2F2F2',
        emoji: '👤',
        status: 'active',
        source: 'self_apply',
        import_batch_id: null,
        created_at: now,
        updated_at: now,
      });
      creatorId = creator.id;

      if (applicant.video_url) {
        const { extractYouTubeId } = await import('@/lib/utils');
        const youtubeId = extractYouTubeId(applicant.video_url);
        await db.insert('creator_portfolio', {
          creator_id: creator.id,
          type: 'video',
          url: applicant.video_url,
          thumbnail: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
          youtube_id: youtubeId,
          label: 'Portfolio video',
          sort_order: 0,
          created_at: now,
        });
      }
    }
  }

  const updated = await db.update('applicants', id, {
    status: decision,
    admin_notes: adminNotes ?? applicant.admin_notes,
    creator_id: creatorId,
  });

  await sendEmail(applicantDecisionEmail(updated ?? applicant, decision === 'approved'), {
    type: 'applicant',
    id,
  });

  revalidatePath('/admin/applicants');
  revalidatePath('/admin/creators');
  revalidatePath('/marketplace');

  return {
    ok: true,
    message:
      decision === 'approved'
        ? `${applicant.name} approved and added to the roster.`
        : `${applicant.name} rejected — a notification email was sent.`,
  };
}

// ── Deals ──────────────────────────────────────────────────────────────────

export async function updateDealStatusAction(
  id: string,
  status: DealStatus,
): Promise<ActionResult> {
  await requireAdmin();
  const updated = await db.update('deals', id, { status, updated_at: new Date().toISOString() });
  if (!updated) return { ok: false, message: 'Deal not found.' };

  revalidatePath('/admin/deals');
  return { ok: true, message: `${updated.deal_ref} → ${status.replace(/_/g, ' ')}.` };
}

/** Re-sends the brief to a creator when the first notification failed. */
export async function resendCreatorNotificationAction(dealId: string): Promise<ActionResult> {
  await requireAdmin();

  const deal = await db.get('deals', dealId);
  if (!deal) return { ok: false, message: 'Deal not found.' };

  const creator = await db.get('creators', deal.creator_id);
  if (!creator) return { ok: false, message: 'Creator not found.' };
  if (!creator.contact_email) {
    return { ok: false, message: `${creator.name} has no contact email on file. Add one first.` };
  }

  const result = await sendEmail(creatorBookedEmail(deal, creator), { type: 'deal', id: deal.id });
  if (!result.ok) return { ok: false, message: result.error ?? 'Send failed.' };

  await db.update('deals', dealId, { creator_notified_at: new Date().toISOString() });
  revalidatePath('/admin/deals');
  return { ok: true, message: `Brief re-sent to ${creator.contact_email}.` };
}

// ── Regional booking requests (requirement #2 follow-up) ───────────────────

export async function updateBookingRequestAction(
  id: string,
  status: BookingRequestStatus,
  adminNotes?: string,
): Promise<ActionResult> {
  const user = await requireAdmin();

  const updated = await db.update('booking_requests', id, {
    status,
    admin_notes: adminNotes ?? undefined,
    handled_by: user.id,
  });
  if (!updated) return { ok: false, message: 'Request not found.' };

  revalidatePath('/admin/booking-requests');
  return { ok: true, message: `${updated.request_ref} → ${status}.` };
}

export async function updatePartnershipStatusAction(
  id: string,
  status: 'new' | 'in_discussion' | 'converted' | 'closed',
): Promise<ActionResult> {
  await requireAdmin();
  const updated = await db.update('partnership_requests', id, { status });
  if (!updated) return { ok: false, message: 'Request not found.' };

  revalidatePath('/admin/partnership');
  return { ok: true, message: `Marked ${status.replace(/_/g, ' ')}.` };
}

// ── Campaigns ──────────────────────────────────────────────────────────────

export async function createCampaignAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const title = String(formData.get('title') ?? '').trim();
  const brand = String(formData.get('brand_name') ?? '').trim();
  if (!title || !brand) return { ok: false, message: 'Brand and title are required.' };

  const publish = formData.get('publish') === 'on';
  const now = new Date().toISOString();

  await db.insert('campaigns', {
    brand_id: null,
    brand_name: brand,
    title,
    category: String(formData.get('category') ?? '').trim() || null,
    content_type: String(formData.get('content_type') ?? '').trim() || null,
    platform: String(formData.get('platform') ?? '').trim() || null,
    spots_total: Number(formData.get('spots_total') ?? 5) || 5,
    spots_filled: 0,
    budget_usd: Number(formData.get('budget_usd') ?? 0) || null,
    rate_label: String(formData.get('rate_label') ?? '').trim() || null,
    brief_text: String(formData.get('brief_text') ?? '').trim() || null,
    emoji: String(formData.get('emoji') ?? '🎬').trim() || '🎬',
    accent_bg: '#F2F2F2',
    status: publish ? 'active' : 'draft',
    published_at: publish ? now : null,
    created_at: now,
  });

  revalidatePath('/admin/campaigns');
  revalidatePath('/campaigns');
  return { ok: true, message: publish ? 'Campaign published.' : 'Campaign saved as draft.' };
}

export async function updateCampaignStatusAction(
  id: string,
  status: 'draft' | 'active' | 'paused' | 'completed',
): Promise<ActionResult> {
  await requireAdmin();
  const updated = await db.update('campaigns', id, {
    status,
    published_at: status === 'active' ? new Date().toISOString() : undefined,
  });
  if (!updated) return { ok: false, message: 'Campaign not found.' };

  revalidatePath('/admin/campaigns');
  revalidatePath('/campaigns');
  return { ok: true, message: `${updated.title} → ${status}.` };
}

// ── Plan upgrades ──────────────────────────────────────────────────────────
// The VEA team applies a plan change here when Stripe is not handling it (no
// key configured, an Enterprise contract, or a failed self-serve checkout).

export async function approveUpgradeRequestAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const request = await db.get('upgrade_requests', id);
  if (!request) return { ok: false, message: 'Upgrade request not found.' };
  if (request.status !== 'pending') {
    return { ok: false, message: `This request is already ${request.status}.` };
  }

  const user = await db.get('users', request.user_id);
  if (!user) return { ok: false, message: 'That brand account no longer exists.' };

  const previous = user.plan;
  const now = new Date().toISOString();

  await db.update('users', user.id, { plan: request.to_plan });
  await db.update('upgrade_requests', request.id, {
    status: 'approved',
    decided_by: admin.id,
    decided_at: now,
  });

  if (previous !== request.to_plan) {
    await sendEmail(brandPlanChangedEmail(user.email, previous, request.to_plan), {
      type: 'plan_change',
      id: user.id,
    });
  }

  revalidatePath('/admin/upgrade-requests');
  revalidatePath('/dashboard/plan');
  return {
    ok: true,
    message: `${user.email} is now on ${planName(request.to_plan)}.`,
  };
}

export async function rejectUpgradeRequestAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const request = await db.get('upgrade_requests', id);
  if (!request) return { ok: false, message: 'Upgrade request not found.' };
  if (request.status !== 'pending') {
    return { ok: false, message: `This request is already ${request.status}.` };
  }

  await db.update('upgrade_requests', request.id, {
    status: 'rejected',
    decided_by: admin.id,
    decided_at: new Date().toISOString(),
  });

  revalidatePath('/admin/upgrade-requests');
  return { ok: true, message: 'Request rejected — the plan was left unchanged.' };
}

/** Direct plan override, for a contract signed outside the request flow. */
export async function setUserPlanAction(userId: string, plan: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isPlan(plan)) return { ok: false, message: 'Unknown plan.' };

  const user = await db.get('users', userId);
  if (!user) return { ok: false, message: 'Account not found.' };
  if (user.plan === plan) return { ok: true, message: `Already on ${planName(plan)}.` };

  const previous = user.plan;
  await db.update('users', user.id, { plan });
  await sendEmail(brandPlanChangedEmail(user.email, previous, plan), {
    type: 'plan_change',
    id: user.id,
  });

  revalidatePath('/admin/upgrade-requests');
  revalidatePath('/dashboard/plan');
  return { ok: true, message: `${user.email}: ${planName(previous)} → ${planName(plan)}.` };
}
