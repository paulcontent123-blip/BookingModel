import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminSessionUser } from '@/lib/auth';
import { CloudinaryError, isCloudinaryDeliveryUrl, uploadCreatorImage } from '@/lib/cloudinary';
import { config } from '@/lib/config';
import {
  accentBgFor,
  defaultAvatarUrl,
  extractYouTubeId,
  normalizeHandle,
  parseAudience,
  parseRateRange,
  tierFor,
  creatorIdentityKey,
} from '@/lib/utils';
import type { Creator } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/admin/creators/import — bulk creator import (TechSpec §4).
 *
 * The file is parsed in the browser (CSV via PapaParse, XLSX via SheetJS) so
 * this endpoint receives plain rows and stays independent of the file format.
 * Dedup key is the pair `platform + handle`, because a creator can use the
 * same username on multiple platforms.
 */

interface ImportRow {
  legacy_id?: string;
  name?: string;
  handle?: string;
  platform?: string;
  channel_url?: string;
  audience?: string;
  avg_views_likes?: string;
  er?: string;
  tier?: string;
  location?: string;
  rate?: string;
  niche?: string;
  category?: string;
  contact?: string;
  notes?: string;
  photo_url?: string;
  avatar_url?: string;
  avatar_filename?: string;
  video_url?: string;
}

interface UpdatePlan {
  id: string;
  fields: Partial<Creator>;
}

interface PendingImageUpload {
  row: number;
  target: Partial<Creator>;
  photoUrl: string | null;
  avatarUrl: string | null;
  updatePlan?: UpdatePlan;
}

function parseIntegerMetric(raw: string | undefined): number | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  return parseAudience(value);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Converts a shareable Google Drive file URL into an image URL. */
function imageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'drive.google.com' || url.hostname.endsWith('.drive.google.com')) {
      const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/i);
      const fileId = pathMatch?.[1] ?? url.searchParams.get('id');
      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
      }
    }
  } catch {
    // Keep the original value for the normal validation below.
  }

  return trimmed;
}

function imageFields(row: ImportRow): { photoUrl: string | null; avatarUrl: string | null } {
  const photoUrl = imageUrl(row.photo_url ?? '');
  const avatarUrl = imageUrl(row.avatar_url ?? '');
  const photo = isHttpUrl(photoUrl) ? photoUrl : isHttpUrl(avatarUrl) ? avatarUrl : null;
  const avatar = isHttpUrl(avatarUrl) ? avatarUrl : isHttpUrl(photoUrl) ? photoUrl : null;
  return { photoUrl: photo, avatarUrl: avatar };
}

async function runConcurrent<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

function imageUploadError(error: unknown): string {
  if (error instanceof CloudinaryError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'The avatar image could not be uploaded to Cloudinary.';
}

async function importCreators(req: Request) {
  const user = await getAdminSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { rows?: ImportRow[]; filename?: string; dryRun?: boolean }
    | null;

  if (!body?.rows?.length) {
    return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });
  }
  if (body.rows.length > 10_000) {
    return NextResponse.json(
      { error: 'Batch too large — split the file into chunks of 10,000 rows.' },
      { status: 413 },
    );
  }

  const existing = await db.list('creators', { limit: 100_000 });
  const seen = new Set(existing.map((c) => creatorIdentityKey(c.platform, c.handle)));
  const existingByIdentity = new Map(
    existing.map((creator) => [creatorIdentityKey(creator.platform, creator.handle), creator]),
  );

  const toInsert: Partial<Creator>[] = [];
  const toUpdate: UpdatePlan[] = [];
  const pendingImageUploads: PendingImageUpload[] = [];
  const portfolio: Record<string, unknown>[] = [];
  const errors: { row: number; reason: string }[] = [];
  let duplicates = 0;
  const now = new Date().toISOString();

  body.rows.forEach((row, i) => {
    const name = (row.name ?? '').trim();
    const handleRaw = (row.handle ?? '').trim();
    const platform = (row.platform ?? '').trim();

    if (!name || !handleRaw || !platform) {
      errors.push({ row: i + 2, reason: 'name, handle and platform are required' });
      return;
    }

    const handle = normalizeHandle(handleRaw);
    const identityKey = creatorIdentityKey(platform, handle);
    if (seen.has(identityKey)) {
      const existingCreator = existingByIdentity.get(identityKey);
      const { photoUrl, avatarUrl } = imageFields(row);
      const avatarFilename = (row.avatar_filename ?? '').trim();
      const patch: Partial<Creator> = {};

      // Re-importing the official workbook also re-hosts an existing external
      // image. A Cloudinary URL is treated as curated and is left untouched.
      if (existingCreator) {
        const shouldUploadPhoto = Boolean(photoUrl)
          && !isCloudinaryDeliveryUrl(existingCreator.photo_url ?? '');
        const shouldUploadAvatar = Boolean(avatarUrl)
          && !isCloudinaryDeliveryUrl(existingCreator.avatar_url ?? '');
        const shouldUpdateFilename = Boolean(avatarFilename) && !existingCreator.avatar_filename;

        if (shouldUploadPhoto || shouldUploadAvatar || shouldUpdateFilename) {
          if (shouldUpdateFilename) patch.avatar_filename = avatarFilename;
          patch.updated_at = now;
          const updatePlan: UpdatePlan = { id: existingCreator.id, fields: patch };
          toUpdate.push(updatePlan);
          if (shouldUploadPhoto || shouldUploadAvatar) {
            pendingImageUploads.push({
              row: i + 2,
              target: patch,
              photoUrl: shouldUploadPhoto ? photoUrl : null,
              avatarUrl: shouldUploadAvatar ? avatarUrl : null,
              updatePlan,
            });
          }
        }
      }
      duplicates++;
      return;
    }
    seen.add(identityKey);

    const audience = (row.audience ?? '').trim() || null;
    const audienceCount = parseAudience(audience);
    const avgViewsLikesRaw = (row.avg_views_likes ?? '').trim();
    const avgViewsLikes = parseIntegerMetric(avgViewsLikesRaw);
    if (avgViewsLikesRaw && avgViewsLikes == null) {
      errors.push({ row: i + 2, reason: 'avg_views_likes must be a number such as 2800 or 2.8K' });
      return;
    }
    const rate = parseRateRange(row.rate);
    const contact = (row.contact ?? '').trim();
    const emailMatch = contact.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    const { photoUrl, avatarUrl } = imageFields(row);

    // The id is generated here so portfolio rows can reference it in one pass.
    const id = crypto.randomUUID();

    const creator: Partial<Creator> = {
      id,
      legacy_id: parseIntegerMetric(row.legacy_id),
      user_id: null,
      name,
      handle,
      platform,
      channel_url: (row.channel_url ?? '').trim() || null,
      niche: (row.niche ?? '').trim() || null,
      category: (row.category ?? '').trim() || null,
      tier: (row.tier ?? '').trim() || tierFor(audienceCount),
      audience,
      audience_count: audienceCount,
      avg_views_likes: avgViewsLikes,
      location: (row.location ?? '').trim() || null,
      er: (row.er ?? '').trim() || null,
      rate_min: rate.min,
      rate_max: rate.max,
      contact_email: emailMatch ? emailMatch[0] : null,
      contact_hint: contact || null,
      contact_verified: !!emailMatch,
      bd_notes: (row.notes ?? '').trim() || null,
      bio: (row.notes ?? '').trim() || null,
      photo_url: photoUrl,
      avatar_url: avatarUrl ?? defaultAvatarUrl(handle),
      avatar_filename: (row.avatar_filename ?? '').trim() || null,
      accent_bg: accentBgFor(handle),
      emoji: '👤',
      status: 'active',
      source: 'csv_import',
      import_batch_id: null,
      created_at: now,
      updated_at: now,
    };
    toInsert.push(creator);

    if (photoUrl || avatarUrl) {
      pendingImageUploads.push({
        row: i + 2,
        target: creator,
        photoUrl,
        avatarUrl,
      });
    }

    const videoUrl = (row.video_url ?? '').trim();
    if (videoUrl) {
      const youtubeId = extractYouTubeId(videoUrl);
      portfolio.push({
        creator_id: id,
        type: 'video',
        url: videoUrl,
        thumbnail: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
        youtube_id: youtubeId,
        label: 'Portfolio video',
        sort_order: 0,
        created_at: now,
      });
    }
  });

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      willImport: toInsert.length,
      willUpdate: toUpdate.length,
      duplicates,
      errors,
      preview: toInsert.slice(0, 10),
    });
  }

  const needsCloudinaryUpload = pendingImageUploads.some((pending) =>
    [pending.photoUrl, pending.avatarUrl].some(
      (source) => Boolean(source) && !isCloudinaryDeliveryUrl(source!),
    ),
  );
  if (needsCloudinaryUpload && !config.cloudinary.enabled) {
    return NextResponse.json(
      {
        error:
          'Cloudinary is required for avatar links. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET before importing.',
      },
      { status: 503 },
    );
  }

  const imageUploadCache = new Map<string, ReturnType<typeof uploadCreatorImage>>();
  const rehostedImages = new Set<string>();
  const failedInsertTargets = new Set<Partial<Creator>>();
  const failedUpdateIds = new Set<string>();

  const uploadCached = (source: string) => {
    const cached = imageUploadCache.get(source);
    if (cached) return cached;
    const pending = uploadCreatorImage(source);
    imageUploadCache.set(source, pending);
    return pending;
  };

  await runConcurrent(pendingImageUploads, 4, async (pending) => {
    try {
      const photoUpload = pending.photoUrl
        ? await uploadCached(pending.photoUrl)
        : null;
      const avatarUpload = pending.avatarUrl
        ? pending.avatarUrl === pending.photoUrl
          ? photoUpload
          : await uploadCached(pending.avatarUrl)
        : null;

      if (photoUpload) {
        pending.target.photo_url = photoUpload.secureUrl;
        if (!photoUpload.skipped) rehostedImages.add(photoUpload.secureUrl);
      }
      if (avatarUpload) {
        pending.target.avatar_url = avatarUpload.secureUrl;
        if (!avatarUpload.skipped) rehostedImages.add(avatarUpload.secureUrl);
      }
    } catch (error) {
      if (pending.updatePlan) failedUpdateIds.add(pending.updatePlan.id);
      else failedInsertTargets.add(pending.target);
      errors.push({ row: pending.row, reason: `avatar upload failed: ${imageUploadError(error)}` });
    }
  });

  const rowsToInsert = toInsert.filter((creator) => !failedInsertTargets.has(creator));
  const updatesToApply = toUpdate.filter((update) => !failedUpdateIds.has(update.id));

  const batch = await db.insert('import_batches', {
    filename: body.filename ?? 'upload',
    total_rows: body.rows.length,
    imported: rowsToInsert.length,
    duplicates,
    errors: errors.length,
    status: 'completed',
    imported_by: user.id,
    created_at: now,
  });

  if (rowsToInsert.length) {
    await db.insertMany(
      'creators',
      rowsToInsert.map((c) => ({ ...c, import_batch_id: batch.id })),
    );
  }
  for (const update of updatesToApply) {
    await db.update('creators', update.id, update.fields);
  }
  if (portfolio.length) await db.insertMany('creator_portfolio', portfolio as never[]);

  return NextResponse.json({
    ok: true,
    batch_id: batch.id,
    imported: rowsToInsert.length,
    updated: updatesToApply.length,
    images_uploaded: rehostedImages.size,
    duplicates,
    errors,
  });
}

/** Always return JSON so the Admin UI can show the real local failure. */
export async function POST(req: Request) {
  try {
    return await importCreators(req);
  } catch (error) {
    console.error('[creator-import] failed:', error);
    const detail = error instanceof Error ? error.message : 'Unknown creator import error.';
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === 'production'
          ? 'Creator import failed. Check the server log for details.'
          : detail,
      },
      { status: 500 },
    );
  }
}
