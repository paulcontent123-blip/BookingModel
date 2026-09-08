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
  avatarUrl?: string;
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
  const avatarUrl = (input.avatarUrl ?? '').trim();
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

  if (avatarUrl && !isHttpUrl(avatarUrl)) {
    return 'Avatar URL must start with http:// or https://.';
  }

  if (videoUrl && !extractYouTubeId(videoUrl)) {
    return 'Portfolio video must be a valid YouTube URL.';
  }

  if (!['active', 'pending', 'inactive', 'rejected'].includes(status)) {
    return 'Please select a valid creator status.';
  }

  return null;
}

// ── Portfolio gallery ──────────────────────────────────────────────────────
// The seeded roster carries several samples per creator, so the admin form
// posts the whole gallery as one JSON field and the server action rewrites the
// creator_portfolio rows from it.

export const PORTFOLIO_MAX_ITEMS = 8;

export interface PortfolioDraft {
  type: 'image' | 'video';
  url: string;
  thumbnail: string | null;
  youtube_id: string | null;
  label: string | null;
}

/**
 * Parse the `portfolio` form field. Returns the cleaned drafts in display
 * order, or the first human-readable error.
 */
export function parsePortfolioInput(
  raw: string | null | undefined,
): { items: PortfolioDraft[]; error: string | null } {
  const text = (raw ?? '').trim();
  if (!text) return { items: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { items: [], error: 'The portfolio gallery could not be read. Please try again.' };
  }
  if (!Array.isArray(parsed)) {
    return { items: [], error: 'The portfolio gallery could not be read. Please try again.' };
  }
  if (parsed.length > PORTFOLIO_MAX_ITEMS) {
    return { items: [], error: `A creator can have at most ${PORTFOLIO_MAX_ITEMS} portfolio items.` };
  }

  const items: PortfolioDraft[] = [];
  for (const entry of parsed) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const url = String(row.url ?? '').trim();
    const type = String(row.type ?? '').trim();
    const label = String(row.label ?? '').trim();

    if (type !== 'image' && type !== 'video') {
      return { items: [], error: 'Every portfolio item must be an image or a video.' };
    }
    if (!url) return { items: [], error: 'Every portfolio item needs a URL.' };

    if (type === 'video') {
      const youtubeId = extractYouTubeId(url);
      if (!youtubeId) return { items: [], error: `"${url}" is not a valid YouTube URL.` };
      items.push({
        type: 'video',
        url,
        thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        youtube_id: youtubeId,
        label: label || 'Portfolio video',
      });
      continue;
    }

    if (!isHttpUrl(url)) {
      return { items: [], error: 'Portfolio image URLs must start with http:// or https://.' };
    }
    const thumbnail = String(row.thumbnail ?? '').trim();
    items.push({
      type: 'image',
      url,
      thumbnail: thumbnail && isHttpUrl(thumbnail) ? thumbnail : url,
      youtube_id: null,
      label: label || 'Content sample',
    });
  }

  return { items, error: null };
}
