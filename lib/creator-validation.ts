import {
  CATEGORIES,
  PLATFORMS,
  extractYouTubeId,
  normalizeHandle,
  parseAudience,
  parseRateRange,
} from '@/lib/utils';

export interface CreatorValidationInput {
  name: string;
  handle: string;
  platform: string;
  channelUrl?: string;
  category?: string;
  audience?: string;
  er?: string;
  rate?: string;
  contactEmail?: string;
  photoUrl?: string;
  videoUrl?: string;
  status?: string;
}

export const CREATOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CREATOR_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export function validateCreatorImageFile(file: File): string | null {
  if (file.size === 0) return 'The selected image is empty.';
  if (file.size > CREATOR_IMAGE_MAX_BYTES) return 'The selected image must be 10 MB or smaller.';
  if (!CREATOR_IMAGE_TYPES.includes(file.type.toLowerCase() as (typeof CREATOR_IMAGE_TYPES)[number])) {
    return 'Only JPG, PNG, WebP, GIF and AVIF images are supported.';
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Shared validation for the Add/Edit Creator form and its server action.
 * Return the first human-readable error so the UI can show a useful message.
 */
export function validateCreatorInput(input: CreatorValidationInput): string | null {
  const name = input.name.trim();
  const handle = normalizeHandle(input.handle);
  const platform = input.platform.trim();
  const channelUrl = (input.channelUrl ?? '').trim();
  const category = (input.category ?? '').trim();
  const audience = (input.audience ?? '').trim();
  const er = (input.er ?? '').trim();
  const rate = (input.rate ?? '').trim();
  const contactEmail = (input.contactEmail ?? '').trim();
  const photoUrl = (input.photoUrl ?? '').trim();
  const videoUrl = (input.videoUrl ?? '').trim();
  const status = (input.status ?? 'active').trim();

  if (!name) return 'Name is required.';
  if (name.length > 120) return 'Name must be 120 characters or fewer.';

  if (!input.handle.trim()) return 'Handle is required.';
  if (!/^@[A-Za-z0-9._-]+$/.test(handle)) {
    return 'Handle must contain only letters, numbers, dots, underscores or hyphens.';
  }

  if (!platform) return 'Platform is required.';
  if (![...PLATFORMS, 'Other'].includes(platform as (typeof PLATFORMS)[number] | 'Other')) {
    return 'Please select a valid platform.';
  }

  if (channelUrl && !isHttpUrl(channelUrl)) {
    return 'Channel URL must start with http:// or https://.';
  }

  if (category && !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return 'Please select a valid category.';
  }

  if (audience) {
    if (!/^\d[\d,]*(?:\.\d+)?\s*[kKmM]?$/.test(audience) || parseAudience(audience) == null) {
      return 'Audience must be a number such as 82K, 1.5M or 82000.';
    }
    if ((parseAudience(audience) ?? 0) < 0) return 'Audience cannot be negative.';
  }

  if (er) {
    const erValue = Number(er.replace(/%/g, '').trim());
    if (!Number.isFinite(erValue) || erValue < 0 || erValue > 100) {
      return 'Engagement rate must be a percentage between 0% and 100%.';
    }
  }

  if (rate) {
    if (!/^\$?\s*[\d,]+(?:\s*(?:-|–|—|to)\s*\$?\s*[\d,]+)?\s*$/i.test(rate)) {
      return 'Rate range must look like $150-350 or $170.';
    }
    const parsedRate = parseRateRange(rate);
    if (
      parsedRate.min == null ||
      parsedRate.max == null ||
      parsedRate.min < 0 ||
      parsedRate.max < parsedRate.min
    ) {
      return 'Rate range must contain valid non-negative amounts.';
    }
  }

  if (contactEmail && !isValidEmail(contactEmail)) {
    return 'Contact email is not valid.';
  }

  if (photoUrl && !isHttpUrl(photoUrl)) {
    return 'Photo URL must start with http:// or https://.';
  }

  if (videoUrl && !extractYouTubeId(videoUrl)) {
    return 'Portfolio video must be a valid YouTube URL.';
  }

  if (!['active', 'pending', 'inactive', 'rejected'].includes(status)) {
    return 'Please select a valid creator status.';
  }

  return null;
}
