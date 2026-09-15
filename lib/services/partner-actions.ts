'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { CloudinaryError, deleteCloudinaryImage } from '@/lib/cloudinary';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { Partner, PartnerStatus } from '@/lib/types';

const PARTNER_STATUSES: PartnerStatus[] = ['draft', 'published'];

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

function statusOf(formData: FormData): PartnerStatus {
  return text(formData, 'status') === 'published' ? 'published' : 'draft';
}

function validUrl(value: string | null, label: string): { value: string | null; error?: string } {
  if (!value) return { value: null };

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { value: null, error: `${label} must start with http:// or https://.` };
    }
    return { value };
  } catch {
    return { value: null, error: `${label} must be a valid URL.` };
  }
}

function partnerFieldsFrom(formData: FormData): Partial<Partner> | string {
  const name = text(formData, 'name');
  if (!name) return 'A partner name is required.';
  if (name.length > 160) return 'The partner name must be 160 characters or fewer.';

  const category = optional(formData, 'category');
  if (category && category.length > 100) return 'The category must be 100 characters or fewer.';

  const icon = optional(formData, 'icon');
  if (icon && icon.length > 16) return 'The icon must be 16 characters or fewer.';

  const ctaLabel = optional(formData, 'cta_label');
  if (ctaLabel && ctaLabel.length > 80) return 'The call-to-action label must be 80 characters or fewer.';

  const website = validUrl(optional(formData, 'website_url'), 'Website URL');
  if (website.error) return website.error;

  const logo = validUrl(optional(formData, 'cover_url'), 'Logo URL');
  if (logo.error) return logo.error;

  const description = optional(formData, 'description');
  if (description && description.length > 1000) return 'The description must be 1,000 characters or fewer.';

  const sortOrder = Number.parseInt(text(formData, 'sort_order') || '0', 10);

  return {
    name,
    icon,
    cta_label: ctaLabel,
    category,
    website_url: website.value,
    description,
    logo_url: logo.value,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    status: statusOf(formData),
  };
}

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof CloudinaryError) return error.message;
  console.error('[partner-actions]', error);
  return fallback;
}

function revalidatePartners(id?: string): void {
  revalidatePath('/partnership');
  revalidatePath('/admin/partners');
  if (id) revalidatePath(`/admin/partners/${id}`);
}

export async function createPartnerAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const fields = partnerFieldsFrom(formData);
  if (typeof fields === 'string') return { ok: false, message: fields };

  try {
    const now = new Date().toISOString();
    const partner = await db.insert('partners', {
      ...fields,
      created_at: now,
      updated_at: now,
    });

    revalidatePartners();
    return {
      ok: true,
      message: partner.status === 'published'
        ? `${partner.name} is now visible on the public Partnership page.`
        : `${partner.name} was saved as a draft.`,
    };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The partner could not be created.') };
  }
}

export async function updatePartnerAction(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const fields = partnerFieldsFrom(formData);
  if (typeof fields === 'string') return { ok: false, message: fields };

  try {
    const existing = await db.get('partners', id);
    if (!existing) return { ok: false, message: 'That partner no longer exists.' };

    if (existing.logo_url && existing.logo_url !== fields.logo_url) {
      try {
        await deleteCloudinaryImage(existing.logo_url);
      } catch (error) {
        console.error('[partner-actions] old logo cleanup', error);
      }
    }

    const updated = await db.update('partners', id, {
      ...fields,
      updated_at: new Date().toISOString(),
    });

    revalidatePartners(id);
    return { ok: true, message: `${updated?.name ?? existing.name} was updated.` };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The partner could not be updated.') };
  }
}

export async function deletePartnerAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    const partner = await db.get('partners', id);
    if (!partner) return { ok: false, message: 'That partner no longer exists.' };

    await deleteCloudinaryImage(partner.logo_url);
    await db.remove('partners', id);

    revalidatePartners();
    return { ok: true, message: `${partner.name} was deleted.` };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The partner could not be deleted.') };
  }
}

export async function setPartnerStatusAction(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();

  const next = status as PartnerStatus;
  if (!PARTNER_STATUSES.includes(next)) return { ok: false, message: 'Invalid partner status.' };

  const partner = await db.get('partners', id);
  if (!partner) return { ok: false, message: 'That partner no longer exists.' };

  await db.update('partners', id, { status: next, updated_at: new Date().toISOString() });
  revalidatePartners(id);
  return {
    ok: true,
    message: next === 'published' ? 'The partner is now public.' : 'The partner is hidden from the public site.',
  };
}
