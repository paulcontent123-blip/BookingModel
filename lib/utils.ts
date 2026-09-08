import type { Creator } from './types';

export function money(usd: number | null | undefined, opts: { cents?: boolean } = {}): string {
  const value = usd ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(value);
}

export function compactNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function rateLabel(creator: Pick<Creator, 'rate_min' | 'rate_max'>): string {
  if (creator.rate_min == null && creator.rate_max == null) return 'On request';
  if (creator.rate_min != null && creator.rate_max != null && creator.rate_min !== creator.rate_max) {
    return `${money(creator.rate_min)}–${money(creator.rate_max)}`;
  }
  return money(creator.rate_min ?? creator.rate_max);
}

/** Price we charge for one deliverable — the midpoint of the creator's range. */
export function unitPriceFor(creator: Pick<Creator, 'rate_min' | 'rate_max'>): number {
  const min = creator.rate_min ?? creator.rate_max ?? 0;
  const max = creator.rate_max ?? creator.rate_min ?? 0;
  if (!min && !max) return 0;
  return Math.round((min + max) / 2);
}

export function parseRateRange(raw: string | null | undefined): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const nums = String(raw)
    .replace(/[$,\s]/g, '')
    .split(/[–\-—to]+/i)
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return { min: null, max: null };
  return { min: nums[0]!, max: nums[1] ?? nums[0]! };
}

export function parseAudience(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().replace(/,/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (s.endsWith('M')) return Math.round(n * 1_000_000);
  if (s.endsWith('K')) return Math.round(n * 1_000);
  return Math.round(n);
}

export function tierFor(audienceCount: number | null): string {
  if (!audienceCount) return 'Micro';
  if (audienceCount < 10_000) return 'Nano';
  if (audienceCount < 100_000) return 'Micro';
  if (audienceCount < 1_000_000) return 'Mid';
  return 'Macro';
}

export function normalizeHandle(handle: string): string {
  const h = handle.trim();
  return h.startsWith('@') ? h : `@${h}`;
}

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1]! : null;
}

/** Sequential human-readable reference: BM-2026-0007 */
export function makeRef(prefix: string, sequence: number, year = new Date().getFullYear()): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const;

export const CATEGORIES = [
  'Food & Beverage',
  'Beauty & Skincare',
  'Fitness & Wellness',
  'Lifestyle',
  'Tech & Apps',
  'Home & Family',
  'Fashion',
] as const;

export const CONTENT_TYPES = [
  'UGC Video (30s)',
  'UGC Video (60s)',
  'Testimonial',
  'Unboxing',
  'Product Demo',
  'Recipe / Tutorial',
  'Before & After',
  'Livestream Segment',
  'Photo Set',
] as const;

export const TIERS = ['Nano', 'Micro', 'Mid', 'Macro'] as const;

export function platformClass(platform: string | null | undefined): string {
  switch ((platform ?? '').toLowerCase()) {
    case 'tiktok': return 'cg-b-tiktok';
    case 'instagram': return 'cg-b-instagram';
    case 'youtube': return 'cg-b-youtube';
    case 'facebook': return 'cg-b-facebook';
    default: return 'cg-b-tiktok';
  }
}

/**
 * Renders a stored fee rate without trailing zeros: 15 -> "15", 12.5 -> "12.5".
 * Deals and invoices keep the rate they were charged at, so a document written
 * on an old plan never re-renders at today's rate.
 */
export function feePercentLabel(percent: number | null | undefined): string {
  const n = Number(percent);
  if (!Number.isFinite(n)) return '0';
  return String(Number(n.toFixed(2)));
}
