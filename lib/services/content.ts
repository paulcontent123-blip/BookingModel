import 'server-only';
import { db } from '@/lib/db';
import { normalizeMetrics } from '@/lib/content';
import type { NewsPost, ShowcaseCase } from '@/lib/types';

/**
 * Read side of the News & Showcase CMS.
 *
 * Every public query filters on status = 'published' here rather than in the
 * page, so a draft can never leak into the marketing site by accident.
 */

/** jsonb comes back parsed from Supabase but may be a string in the JSON store. */
function hydrate(row: ShowcaseCase): ShowcaseCase {
  return { ...row, metrics: normalizeMetrics(row.metrics) };
}

function byPublishedDesc(a: NewsPost, b: NewsPost): number {
  return (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at);
}

export async function listPublishedNews(limit?: number): Promise<NewsPost[]> {
  const rows = await db.list('news_posts', { where: { status: 'published' }, limit: 500 });
  const sorted = rows.sort(byPublishedDesc);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** The pinned post first, then the newest — all rendered as uniform cards. */
export async function listNewsForIndex(): Promise<NewsPost[]> {
  const posts = await listPublishedNews();
  const featuredIndex = posts.findIndex((post) => post.featured);
  if (featuredIndex <= 0) return posts;
  const [featured] = posts.splice(featuredIndex, 1);
  return [featured!, ...posts];
}

export async function findNewsBySlug(slug: string): Promise<NewsPost | null> {
  const post = await db.findOne('news_posts', { slug });
  return post && post.status === 'published' ? post : null;
}

/** Same category first, then anything else, never the post being read. */
export async function relatedNews(post: NewsPost, limit = 3): Promise<NewsPost[]> {
  const posts = (await listPublishedNews()).filter((item) => item.id !== post.id);
  const sameCategory = posts.filter((item) => item.category === post.category);
  const rest = posts.filter((item) => item.category !== post.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

export async function newsCategoryCounts(): Promise<{ category: string; count: number }[]> {
  const posts = await listPublishedNews();
  const counts = new Map<string, number>();
  for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export async function listPublishedShowcase(limit?: number): Promise<ShowcaseCase[]> {
  const rows = await db.list('showcase_cases', { where: { status: 'published' }, limit: 500 });
  const sorted = rows
    .map(hydrate)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at),
    );
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function findShowcaseBySlug(slug: string): Promise<ShowcaseCase | null> {
  const item = await db.findOne('showcase_cases', { slug });
  return item && item.status === 'published' ? hydrate(item) : null;
}

export async function relatedShowcase(item: ShowcaseCase, limit = 3): Promise<ShowcaseCase[]> {
  const all = await listPublishedShowcase();
  return all.filter((other) => other.id !== item.id).slice(0, limit);
}

// ── Admin side (drafts included) ───────────────────────────────────────────

export async function listAllNews(): Promise<NewsPost[]> {
  const rows = await db.list('news_posts', { limit: 500 });
  return rows.sort(
    (a, b) =>
      (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at),
  );
}

export async function listAllShowcase(): Promise<ShowcaseCase[]> {
  const rows = await db.list('showcase_cases', { limit: 500 });
  return rows
    .map(hydrate)
    .sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
}

export async function getNewsPost(id: string): Promise<NewsPost | null> {
  return db.get('news_posts', id);
}

export async function getShowcaseCase(id: string): Promise<ShowcaseCase | null> {
  const item = await db.get('showcase_cases', id);
  return item ? hydrate(item) : null;
}
