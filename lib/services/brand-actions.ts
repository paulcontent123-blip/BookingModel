'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requirePlanFeature, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { CloudinaryError, deleteCloudinaryImage } from '@/lib/cloudinary';
import { brandFieldsFrom } from '@/lib/brand-profile';
import { ensureBrandProfile, getBrandById } from '@/lib/services/brand-profile';

export interface BrandActionResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

async function removeOldAvatarSafely(previousUrl: string | null, nextUrl: string | null) {
  if (!previousUrl || previousUrl === nextUrl) return;
  try {
    await deleteCloudinaryImage(previousUrl);
  } catch (error) {
    // Saving the new profile must not fail because a stale CDN asset could
    // not be removed. The old URL is no longer referenced by the profile.
    if (error instanceof CloudinaryError) {
      console.warn('[brand profile] old avatar cleanup skipped:', error.message);
    } else {
      console.warn('[brand profile] old avatar cleanup failed:', error);
    }
  }
}

function profileValidation(formData: FormData, existing: Parameters<typeof brandFieldsFrom>[1]) {
  const parsed = brandFieldsFrom(formData, existing);
  if (!parsed.fields) return { fields: null, error: parsed.error } as const;
  return { fields: parsed.fields, error: null } as const;
}

async function revalidateBrandProfilePages() {
  revalidatePath('/dashboard/account');
  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/bookings');
  revalidatePath('/campaigns');
  revalidatePath('/admin/brands');
}

/** Updates the currently signed-in brand's business profile and avatar. */
export async function updateBrandProfileAction(formData: FormData): Promise<BrandActionResult> {
  const user = await requireUser('/login?next=/dashboard/account');
  const existing = await ensureBrandProfile({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    company_name: user.company_name,
    country: null,
  });
  const parsed = profileValidation(formData, existing);
  if (!parsed.fields) return { ok: false, message: parsed.error };
  const fields = { ...parsed.fields, status: existing.status };

  const now = new Date().toISOString();
  try {
    const updated = await db.update('brands', existing.id, {
      ...fields,
      updated_at: now,
    });
    if (!updated) return { ok: false, message: 'Brand profile was not found.' };

    // Existing campaign ownership and legacy screens use users.company_name.
    // Keep that compatibility field synchronized with the account profile.
    await db.update('users', user.id, {
      company_name: parsed.fields.brand_name,
      country: fields.country,
    });
    await removeOldAvatarSafely(existing.avatar_url, fields.avatar_url);
    await revalidateBrandProfilePages();
    return { ok: true, message: 'Brand account updated successfully.' };
  } catch (error) {
    console.error('[brand profile] could not update account:', error);
    return { ok: false, message: 'The brand account could not be updated. Please try again.' };
  }
}

/** Admin version of the same profile update used by the brand table. */
export async function updateBrandProfileAdminAction(
  id: string,
  formData: FormData,
): Promise<BrandActionResult> {
  await requireAdmin();
  const existing = await getBrandById(id);
  if (!existing) return { ok: false, message: 'Brand profile was not found.' };

  const parsed = profileValidation(formData, existing);
  if (!parsed.fields) return { ok: false, message: parsed.error };

  const now = new Date().toISOString();
  try {
    const updated = await db.update('brands', existing.id, {
      ...parsed.fields,
      updated_at: now,
    });
    if (!updated) return { ok: false, message: 'Brand profile was not found.' };

    await db.update('users', existing.user_id, {
      company_name: parsed.fields.brand_name,
      country: parsed.fields.country,
    });
    await removeOldAvatarSafely(existing.avatar_url, parsed.fields.avatar_url);
    await revalidateBrandProfilePages();
    revalidatePath(`/admin/brands/${id}`);
    return { ok: true, message: 'Brand profile updated successfully.' };
  } catch (error) {
    console.error('[brand profile] admin update failed:', error);
    return { ok: false, message: 'The brand profile could not be updated. Please try again.' };
  }
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
