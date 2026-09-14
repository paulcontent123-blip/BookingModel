import type { NewsPost, ShowcaseCase, ShowcaseMetric } from '@/lib/types';
import { docFirstParagraph, docToPlainText, parseDoc } from '@/lib/content-doc';

/**
 * Shared, dependency-free helpers for the News & Showcase content.
 *
 * Everything here is safe in both server and client components — the database
 * queries live in lib/services/content.ts instead.
 */

export const NEWS_CATEGORIES = [
  'Case Study',
  'Platform Update',
  'Brand Spotlight',
  'Creator Spotlight',
  'Industry Report',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const SHOWCASE_TAGS = ['Case Study', 'Showcase'] as const;

/** Fallback tints so a post without a cover image still looks intentional. */
export const CONTENT_ACCENTS = ['#EEF2EE', '#F2ECEE', '#ECF0F2', '#F0ECF2', '#F2F0EC'] as const;

export function accentForSlug(slug: string): string {
  let sum = 0;
  for (const ch of slug) sum += ch.charCodeAt(0);
  return CONTENT_ACCENTS[sum % CONTENT_ACCENTS.length]!;
}

/** "Aug 14, 2026" — the format the public cards have always used. */
export function formatPublishDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** ISO timestamp for <time dateTime> and JSON-LD. */
export function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function readingMinutes(body: string | null | undefined): number {
  const words = docToPlainText(parseDoc(body)).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// ── Body rendering ─────────────────────────────────────────────────────────
// The editor writes plain text, which keeps the admin form simple and means
// nothing is ever injected into the page as raw HTML. Three shapes exist:
//
//   ## Heading
//   - bullet line
//   anything else -> paragraph (a blank line starts a new block)

export type ContentBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

export function parseBody(body: string | null | undefined): ContentBlock[] {
  const source = (body ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) return [];

  const blocks: ContentBlock[] = [];

  for (const chunk of source.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    // A chunk made only of "- " lines becomes a single list.
    if (lines.every((line) => /^[-*•]\s+/.test(line))) {
      blocks.push({ kind: 'list', items: lines.map((line) => line.replace(/^[-*•]\s+/, '')) });
      continue;
    }

    // Otherwise headings stand alone and the remaining lines of the chunk are
    // joined back into one paragraph, so soft wrapping inside the textarea
    // never splits a sentence across two <p> tags.
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    };

    for (const line of lines) {
      if (/^#{2,3}\s+/.test(line)) {
        flush();
        blocks.push({ kind: 'heading', text: line.replace(/^#{2,3}\s+/, '') });
      } else {
        paragraph.push(line);
      }
    }
    flush();
  }

  return blocks;
}

/** First ~160 characters of the body, used when no excerpt was written. */
export function autoExcerpt(body: string | null | undefined, max = 160): string {
  const text = docFirstParagraph(parseDoc(body));
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

// ── Metrics ────────────────────────────────────────────────────────────────

/** Admin writes one "Label: Value" per line; the database keeps it as JSON. */
export function parseMetrics(raw: string | null | undefined): ShowcaseMetric[] {
  return (raw ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(':');
      if (at === -1) return { label: line, value: '' };
      return { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
    })
    .filter((metric) => metric.label.length > 0);
}

export function metricsToText(metrics: ShowcaseMetric[] | null | undefined): string {
  return (metrics ?? []).map((m) => `${m.label}: ${m.value}`).join('\n');
}

/** Supabase returns jsonb already parsed; the local JSON store may hold text. */
export function normalizeMetrics(value: unknown): ShowcaseMetric[] {
  const raw = typeof value === 'string' ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({ label: String(item.label ?? ''), value: String(item.value ?? '') }))
    .filter((metric) => metric.label.length > 0);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ── Card helpers ───────────────────────────────────────────────────────────

export function newsCardBg(post: Pick<NewsPost, 'slug' | 'accent_bg'>): string {
  return post.accent_bg || accentForSlug(post.slug);
}

export function showcaseCardBg(item: Pick<ShowcaseCase, 'slug' | 'accent_bg'>): string {
  return item.accent_bg || accentForSlug(item.slug);
}
