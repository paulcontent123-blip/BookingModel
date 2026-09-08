'use server';

import { revalidatePath } from 'next/cache';
import { requirePlanFeature } from '@/lib/auth';
import { db } from '@/lib/db';

export interface BrandActionResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

/**
 * Saves a campaign brief for the signed-in brand account.
 *
 * This is deliberately a Brand-side server action. It never calls an Admin
 * API and always attaches the created campaign to the current brand account.
 * Submitted briefs remain drafts until the VEA team reviews and publishes
 * them to the public creator campaign board.
 */
export async function saveBrandBriefAction(formData: FormData): Promise<BrandActionResult> {
  // A server action is a public endpoint, so the plan gate is re-checked here
  // and not only on the page that renders the form.
  const user = await requirePlanFeature('brief_builder');
  const mode = text(formData, 'mode') === 'submit' ? 'submit' : 'draft';
  const title = text(formData, 'title');
  const brief = text(formData, 'brief_text');
  const talkingPoints = text(formData, 'talking_points');

  if (!title) return { ok: false, message: 'Campaign name is required.' };
  if (mode === 'submit' && !brief) {
    return { ok: false, message: 'Please add a campaign brief before submitting.' };
  }

  const spots = Number.parseInt(text(formData, 'spots_total') || '5', 10);
  if (!Number.isInteger(spots) || spots < 1 || spots > 200) {
    return { ok: false, message: 'Creator spots must be a whole number from 1 to 200.' };
  }

  const budgetRaw = text(formData, 'budget_per_creator');
  const budgetPerCreator = budgetRaw ? Number(budgetRaw) : null;
  if (budgetPerCreator != null && (!Number.isFinite(budgetPerCreator) || budgetPerCreator < 0)) {
    return { ok: false, message: 'Budget per creator must be a valid non-negative amount.' };
  }

  const length = text(formData, 'video_length');
  const minFollowers = text(formData, 'min_followers');
  const minEngagement = text(formData, 'min_engagement');
  const preferredPlatform = text(formData, 'preferred_platform');
  const now = new Date().toISOString();
  const instructions = [
    brief,
    talkingPoints ? `Key talking points:\n${talkingPoints}` : '',
    length ? `Video length: ${length}` : '',
    minFollowers ? `Minimum followers: ${minFollowers}` : '',
    minEngagement ? `Minimum engagement rate: ${minEngagement}` : '',
    preferredPlatform ? `Preferred platform: ${preferredPlatform}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    await db.insert('campaigns', {
      brand_id: user.id,
      brand_name: user.company_name ?? user.full_name ?? user.email,
      title,
      category: text(formData, 'category') || null,
      content_type: text(formData, 'content_type') || null,
      platform: text(formData, 'platform') || null,
      spots_total: spots,
      spots_filled: 0,
      budget_usd: budgetPerCreator == null ? null : budgetPerCreator * spots,
      rate_label: budgetPerCreator == null ? null : `$${budgetPerCreator}/creator`,
      brief_text: instructions || null,
      emoji: '🚀',
      accent_bg: '#EEF2FF',
      status: 'draft',
      published_at: null,
      created_at: now,
    });
  } catch (error) {
    console.error('[brand brief] could not save campaign brief:', error);
    return { ok: false, message: 'The campaign brief could not be saved. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/bookings');
  revalidatePath('/dashboard/brief');

  return {
    ok: true,
    message: mode === 'submit'
      ? 'Campaign brief submitted. The VEA team will match creators within 24 hours.'
      : 'Draft saved. You can continue from My Campaigns later.',
  };
}
