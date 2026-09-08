import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publicCreatorShape } from '@/lib/creator-view';
import { getSessionUser } from '@/lib/auth';
import { planHasFeature } from '@/lib/plans';

export const runtime = 'nodejs';

/**
 * GET /api/creators — public, paginated creator list (TechSpec §3.2).
 * Contact details are always stripped from this public list response. The
 * Brand dashboard applies the plan gate for contact reveals separately.
 *
 * `min_er` and `max_rate` are the plan-gated advanced filters: they are ignored
 * for callers whose plan does not include them, rather than 403-ing, so the
 * endpoint keeps working and simply stops applying the paid narrowing.
 *
 * ?q= &platform= &category= &tier= &min_er= &max_rate= &page= &limit=
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const platform = url.searchParams.get('platform');
  const category = url.searchParams.get('category');
  const tier = url.searchParams.get('tier');

  const user = await getSessionUser();
  const advanced = user?.role === 'admin' || planHasFeature(user?.plan, 'advanced_filters');
  const minEr = advanced ? parseFloat(url.searchParams.get('min_er') ?? '') : NaN;
  const maxRate = advanced ? parseInt(url.searchParams.get('max_rate') ?? '', 10) : NaN;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));

  const all = await db.list('creators', { where: { status: 'active' }, orderBy: 'legacy_id' });

  const filtered = all.filter((c) => {
    if (platform && c.platform !== platform) return false;
    if (category && c.category !== category) return false;
    if (tier && c.tier !== tier) return false;
    // A blank engagement rate parses to NaN, and `NaN < minEr` is false — which
    // used to let every creator with no ER on file through the ER filter.
    if (Number.isFinite(minEr)) {
      const er = parseFloat(c.er ?? '');
      if (!Number.isFinite(er) || er < minEr) return false;
    }
    if (Number.isFinite(maxRate) && (c.rate_min ?? 0) > maxRate) return false;
    if (!q) return true;
    return [c.name, c.handle, c.niche, c.category, c.platform]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  });

  const items = filtered.slice((page - 1) * limit, page * limit).map((c) => publicCreatorShape(c, false));

  return NextResponse.json({
    items,
    page,
    limit,
    total: filtered.length,
    pages: Math.max(1, Math.ceil(filtered.length / limit)),
    contact_visible: false,
    advanced_filters_applied: advanced,
  });
}
