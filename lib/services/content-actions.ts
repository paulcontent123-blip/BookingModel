'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { CloudinaryError, deleteCloudinaryImage } from '@/lib/cloudinary';
import { seedContent } from '@/lib/seed';
import { NEWS_CATEGORIES, SHOWCASE_TAGS, accentForSlug, parseMetrics } from '@/lib/content';
import { BRAND_SHOWCASE_ENABLED } from '@/lib/features';
import { isEmptyDoc, parseDoc, serializeDoc } from '@/lib/content-doc';
import { slugify } from '@/lib/utils';
import type { ActionResult } from '@/lib/services/admin-actions';
import type { ContentStatus, NewsPost, ShowcaseCase, TableName } from '@/lib/types';

/**
 * Server actions behind Admin → Content. Like every other admin action these
 * re-check the admin role: a server action is a public endpoint.
 */

const MAX_SLUG_ATTEMPTS = 50;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

function checked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === 'on' || value === 'true' || value === '1';
}

function statusOf(formData: FormData): ContentStatus {
  return text(formData, 'status') === 'published' ? 'published' : 'draft';
}

/** Turns a title (or a typed slug) into a URL-safe slug unique in its table. */
async function uniqueSlug(
  table: Extract<TableName, 'news_posts' | 'showcase_cases'>,
  desired: string,
  fallback: string,
  currentId?: string,
): Promise<string> {
  const base = slugify(desired || fallback) || 'post';
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await db.findOne(table, { slug: candidate });
    if (!existing || existing.id === currentId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * published_at is set the first time a post goes live and kept afterwards, so
 * re-editing a published article does not reorder the index.
 */
function publishedAtFor(
  status: ContentStatus,
  typedDate: string | null,
  existing: string | null,
  now: string,
): string | null {
  if (typedDate) {
    const parsed = new Date(typedDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (status !== 'published') return existing;
  return existing ?? now;
}

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof CloudinaryError) return error.message;
  console.error('[content-actions]', error);
  return fallback;
}

function showcaseDisabled(): ActionResult | null {
  return BRAND_SHOWCASE_ENABLED
    ? null
    : { ok: false, message: 'Brand Showcase is currently disabled.' };
}

/** Every public page that renders news or showcase content. */
function revalidateContent(): void {
  revalidatePath('/');
  revalidatePath('/news');
  revalidatePath('/showcase');
  revalidatePath('/sitemap.xml');
}

/**
 * Loads the five starter articles and four case studies.
 *
 * The automatic first-run seed only fires for the local JSON store, so on
 * Supabase this is how the section gets its initial content. It fills a table
 * only while that table is still empty, which makes it safe to click twice.
 */
export async function seedStarterContentAction(): Promise<ActionResult> {
  await requireAdmin();

  try {
    const [newsBefore, showcaseBefore] = await Promise.all([
      db.count('news_posts'),
      db.count('showcase_cases'),
    ]);

    if (newsBefore > 0 && showcaseBefore > 0) {
      return { ok: false, message: 'Both tables already hold content — nothing was loaded.' };
    }

    await seedContent();

    const [newsAfter, showcaseAfter] = await Promise.all([
      db.count('news_posts'),
      db.count('showcase_cases'),
    ]);

    revalidateContent();
    revalidatePath('/admin/news');
    revalidatePath('/admin/showcase');
    return {
      ok: true,
      message: `Loaded ${newsAfter - newsBefore} articles and ${showcaseAfter - showcaseBefore} case studies.`,
    };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The starter content could not be loaded.') };
  }
}

// ── News ───────────────────────────────────────────────────────────────────

function newsFieldsFrom(formData: FormData): Partial<NewsPost> | string {
  const title = text(formData, 'title');
  if (!title) return 'A title is required.';
  if (title.length > 180) return 'The title must be 180 characters or fewer.';

  const category = text(formData, 'category');
  if (!NEWS_CATEGORIES.includes(category as (typeof NEWS_CATEGORIES)[number])) {
    return 'Choose one of the listed categories.';
  }

  const body = text(formData, 'body');
  const bodyBlocks = parseDoc(body);
  if (!body || isEmptyDoc(bodyBlocks)) return 'The article body cannot be empty.';

  const coverUrl = optional(formData, 'cover_url');
  if (coverUrl && !/^https:\/\//i.test(coverUrl)) {
    return 'The cover image must be an https URL.';
  }

  return {
    category,
    title,
    excerpt: optional(formData, 'excerpt'),
    // Store the sanitized block model, so legacy text is upgraded on the next
    // save and unsupported markup never reaches the database.
    body: serializeDoc(bodyBlocks),
    cover_url: coverUrl,
    emoji: optional(formData, 'emoji'),
    accent_bg: optional(formData, 'accent_bg'),
    author: optional(formData, 'author'),
    seo_title: optional(formData, 'seo_title'),
    seo_description: optional(formData, 'seo_description'),
    featured: checked(formData, 'featured'),
    show_toc: checked(formData, 'show_toc'),
    status: statusOf(formData),
  };
}

/** Only one article can be pinned first on /news. */
async function clearOtherFeatured(keepId: string): Promise<void> {
  const featured = await db.list('news_posts', { where: { featured: true }, limit: 500 });
  for (const post of featured) {
    if (post.id !== keepId) await db.update('news_posts', post.id, { featured: false });
  }
}

export async function createNewsPostAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const fields = newsFieldsFrom(formData);
  if (typeof fields === 'string') return { ok: false, message: fields };

  try {
    const now = new Date().toISOString();
    const slug = await uniqueSlug('news_posts', text(formData, 'slug'), fields.title!);
    const post = await db.insert('news_posts', {
      ...fields,
      slug,
      accent_bg: fields.accent_bg ?? accentForSlug(slug),
      published_at: publishedAtFor(fields.status!, optional(formData, 'published_at'), null, now),
      created_at: now,
      updated_at: now,
    });

    if (post.featured) await clearOtherFeatured(post.id);

    revalidateContent();
    revalidatePath('/admin/news');
    return {
      ok: true,
      message:
        post.status === 'published'
          ? `"${post.title}" is live at /news/${post.slug}.`
          : `"${post.title}" was saved as a draft.`,
    };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The article could not be saved.') };
  }
}

export async function updateNewsPostAction(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const fields = newsFieldsFrom(formData);
  if (typeof fields === 'string') return { ok: false, message: fields };

  try {
    const existing = await db.get('news_posts', id);
    if (!existing) return { ok: false, message: 'That article no longer exists.' };

    const now = new Date().toISOString();
    const slug = await uniqueSlug('news_posts', text(formData, 'slug'), fields.title!, id);

    // Drop the old Cloudinary asset once a new cover replaces it. A cleanup
    // failure only leaves an orphan, so it is logged instead of aborting.
    if (existing.cover_url && existing.cover_url !== fields.cover_url) {
      try {
        await deleteCloudinaryImage(existing.cover_url);
      } catch (error) {
        console.error('[content-actions] old cover cleanup', error);
      }
    }

    const post = await db.update('news_posts', id, {
      ...fields,
      slug,
      accent_bg: fields.accent_bg ?? existing.accent_bg ?? accentForSlug(slug),
      published_at: publishedAtFor(
        fields.status!,
        optional(formData, 'published_at'),
        existing.published_at,
        now,
      ),
      updated_at: now,
    });

    if (post?.featured) await clearOtherFeatured(id);

    revalidateContent();
    revalidatePath('/admin/news');
    revalidatePath(`/admin/news/${id}`);
    revalidatePath(`/news/${slug}`);
    if (existing.slug !== slug) revalidatePath(`/news/${existing.slug}`);
    return { ok: true, message: 'The article was updated.' };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The article could not be updated.') };
  }
}

export async function deleteNewsPostAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    const post = await db.get('news_posts', id);
    if (!post) return { ok: false, message: 'That article no longer exists.' };

    // Remove the hosted cover before the row, so a Cloudinary failure keeps
    // the article instead of orphaning the image.
    await deleteCloudinaryImage(post.cover_url);
    await db.remove('news_posts', id);

    revalidateContent();
    revalidatePath('/admin/news');
    return { ok: true, message: `"${post.title}" was deleted.` };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The article could not be deleted.') };
  }
}

export async function setNewsStatusAction(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();

  const next: ContentStatus = status === 'published' ? 'published' : 'draft';
  const post = await db.get('news_posts', id);
  if (!post) return { ok: false, message: 'That article no longer exists.' };

  const now = new Date().toISOString();
  await db.update('news_posts', id, {
    status: next,
    published_at: next === 'published' ? (post.published_at ?? now) : post.published_at,
    updated_at: now,
  });

  revalidateContent();
  revalidatePath('/admin/news');
  return {
    ok: true,
    message: next === 'published' ? 'The article is now public.' : 'The article is back to draft.',
  };
}

// ── Showcase ───────────────────────────────────────────────────────────────

function showcaseFieldsFrom(formData: FormData): Partial<ShowcaseCase> | string {
  const brand = text(formData, 'brand');
  if (!brand) return 'A brand name is required.';

  const title = text(formData, 'title');
  if (!title) return 'A campaign title is required.';

  const tag = text(formData, 'tag');
  if (!SHOWCASE_TAGS.includes(tag as (typeof SHOWCASE_TAGS)[number])) {
    return 'Choose either Case Study or Showcase.';
  }

  const coverUrl = optional(formData, 'cover_url');
  if (coverUrl && !/^https:\/\//i.test(coverUrl)) {
    return 'The cover image must be an https URL.';
  }

  const sortOrder = Number.parseInt(text(formData, 'sort_order') || '0', 10);

  return {
    brand,
    title,
    tag,
    summary: optional(formData, 'summary'),
    meta: optional(formData, 'meta'),
    challenge: optional(formData, 'challenge'),
    approach: optional(formData, 'approach'),
    outcome: optional(formData, 'outcome'),
    metrics: parseMetrics(text(formData, 'metrics')),
    platform: optional(formData, 'platform'),
    cover_url: coverUrl,
    emoji: optional(formData, 'emoji'),
    accent_bg: optional(formData, 'accent_bg'),
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    status: statusOf(formData),
  };
}

export async function createShowcaseAction(formData: FormData): Promise<ActionResult> {
  const disabled = showcaseDisabled();
  if (disabled) return disabled;

  await requireAdmin();

  const fields = showcaseFieldsFrom(formData);
  if (typeof fields === 'string') return { ok: false, message: fields };

  try {
    const now = new Date().toISOString();
    const slug = await uniqueSlug(
      'showcase_cases',
      text(formData, 'slug'),
      `${fields.brand} ${fields.title}`,
    );

    const item = await db.insert('showcase_cases', {
      ...fields,
      slug,
      accent_bg: fields.accent_bg ?? accentForSlug(slug),
      published_at: publishedAtFor(fields.status!, optional(formData, 'published_at'), null, now),
      created_at: now,
      updated_at: now,
    });

    revalidateContent();
    revalidatePath('/admin/showcase');
    return {
      ok: true,
      message:
        item.status === 'published'
          ? `"${item.title}" is live at /showcase/${item.slug}.`
          : `"${item.title}" was saved as a draft.`,
    };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The case study could not be saved.') };
  }
}

export async function updateShowcaseAction(id: string, formData: FormData): Promise<ActionResult> {
  const disabled = showcaseDisabled();
  if (disabled) return disabled;

  await requireAdmin();

  const fields = showcaseFieldsFrom(formData);
  if (typeof fields === 'string') return { ok: false, message: fields };

  try {
    const existing = await db.get('showcase_cases', id);
    if (!existing) return { ok: false, message: 'That case study no longer exists.' };

    const now = new Date().toISOString();
    const slug = await uniqueSlug(
      'showcase_cases',
      text(formData, 'slug'),
      `${fields.brand} ${fields.title}`,
      id,
    );

    if (existing.cover_url && existing.cover_url !== fields.cover_url) {
      try {
        await deleteCloudinaryImage(existing.cover_url);
      } catch (error) {
        console.error('[content-actions] old cover cleanup', error);
      }
    }

    await db.update('showcase_cases', id, {
      ...fields,
      slug,
      accent_bg: fields.accent_bg ?? existing.accent_bg ?? accentForSlug(slug),
      published_at: publishedAtFor(
        fields.status!,
        optional(formData, 'published_at'),
        existing.published_at,
        now,
      ),
      updated_at: now,
    });

    revalidateContent();
    revalidatePath('/admin/showcase');
    revalidatePath(`/admin/showcase/${id}`);
    revalidatePath(`/showcase/${slug}`);
    if (existing.slug !== slug) revalidatePath(`/showcase/${existing.slug}`);
    return { ok: true, message: 'The case study was updated.' };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The case study could not be updated.') };
  }
}

export async function deleteShowcaseAction(id: string): Promise<ActionResult> {
  const disabled = showcaseDisabled();
  if (disabled) return disabled;

  await requireAdmin();

  try {
    const item = await db.get('showcase_cases', id);
    if (!item) return { ok: false, message: 'That case study no longer exists.' };

    await deleteCloudinaryImage(item.cover_url);
    await db.remove('showcase_cases', id);

    revalidateContent();
    revalidatePath('/admin/showcase');
    return { ok: true, message: `"${item.title}" was deleted.` };
  } catch (error) {
    return { ok: false, message: failureMessage(error, 'The case study could not be deleted.') };
  }
}

export async function setShowcaseStatusAction(id: string, status: string): Promise<ActionResult> {
  const disabled = showcaseDisabled();
  if (disabled) return disabled;

  await requireAdmin();

  const next: ContentStatus = status === 'published' ? 'published' : 'draft';
  const item = await db.get('showcase_cases', id);
  if (!item) return { ok: false, message: 'That case study no longer exists.' };

  const now = new Date().toISOString();
  await db.update('showcase_cases', id, {
    status: next,
    published_at: next === 'published' ? (item.published_at ?? now) : item.published_at,
    updated_at: now,
  });

  revalidateContent();
  revalidatePath('/admin/showcase');
  return {
    ok: true,
    message: next === 'published' ? 'The case study is now public.' : 'It is back to draft.',
  };
}
