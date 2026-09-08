import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminSessionUser } from '@/lib/auth';
import {
  extractYouTubeId,
  normalizeHandle,
  parseAudience,
  parseRateRange,
  tierFor,
} from '@/lib/utils';
import type { Creator } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/admin/creators/import — bulk creator import (TechSpec §4).
 *
 * The file is parsed in the browser (CSV via PapaParse, XLSX via SheetJS) so
 * this endpoint receives plain rows and stays independent of the file format.
 * Dedup key is `handle`, exactly as specified.
 */

interface ImportRow {
  name?: string;
  handle?: string;
  platform?: string;
  channel_url?: string;
  audience?: string;
  er?: string;
  rate?: string;
  niche?: string;
  category?: string;
  contact?: string;
  notes?: string;
  photo_url?: string;
  video_url?: string;
}

export async function POST(req: Request) {
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
  const seen = new Set(existing.map((c) => c.handle.toLowerCase()));

  const toInsert: Partial<Creator>[] = [];
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
    if (seen.has(handle.toLowerCase())) {
      duplicates++;
      return;
    }
    seen.add(handle.toLowerCase());

    const audience = (row.audience ?? '').trim() || null;
    const audienceCount = parseAudience(audience);
    const rate = parseRateRange(row.rate);
    const contact = (row.contact ?? '').trim();
    const emailMatch = contact.match(/[\w.+-]+@[\w-]+\.[\w.]+/);

    // The id is generated here so portfolio rows can reference it in one pass.
    const id = crypto.randomUUID();

    toInsert.push({
      id,
      legacy_id: null,
      user_id: null,
      name,
      handle,
      platform,
      channel_url: (row.channel_url ?? '').trim() || null,
      niche: (row.niche ?? '').trim() || null,
      category: (row.category ?? '').trim() || null,
      tier: tierFor(audienceCount),
      audience,
      audience_count: audienceCount,
      er: (row.er ?? '').trim() || null,
      rate_min: rate.min,
      rate_max: rate.max,
      contact_email: emailMatch ? emailMatch[0] : null,
      contact_hint: contact || null,
      contact_verified: !!emailMatch,
      bd_notes: (row.notes ?? '').trim() || null,
      bio: (row.notes ?? '').trim() || null,
      photo_url: (row.photo_url ?? '').trim() || null,
      avatar_url: null,
      accent_bg: '#F2F2F2',
      emoji: '👤',
      status: 'active',
      source: 'csv_import',
      import_batch_id: null,
      created_at: now,
      updated_at: now,
    } as Partial<Creator>);

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
      duplicates,
      errors,
      preview: toInsert.slice(0, 10),
    });
  }

  const batch = await db.insert('import_batches', {
    filename: body.filename ?? 'upload',
    total_rows: body.rows.length,
    imported: toInsert.length,
    duplicates,
    errors: errors.length,
    status: 'completed',
    imported_by: user.id,
    created_at: now,
  });

  if (toInsert.length) {
    await db.insertMany(
      'creators',
      toInsert.map((c) => ({ ...c, import_batch_id: batch.id })),
    );
  }
  if (portfolio.length) await db.insertMany('creator_portfolio', portfolio as never[]);

  return NextResponse.json({
    ok: true,
    batch_id: batch.id,
    imported: toInsert.length,
    duplicates,
    errors,
  });
}
