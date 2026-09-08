import 'server-only';
import crypto from 'node:crypto';
import { db, usingLocalStore } from './db';
import { config } from './config';
import { hashPassword } from './auth';
import { PLAN_ORDER, PLANS, revealLimitLabel } from './plans';
import creatorsData from '@/data/creators.json';
import campaignsData from '@/data/campaigns.json';
import type { Creator } from './types';

/**
 * Loads the demo dataset (40 vetted creators + demo accounts + open campaigns).
 *
 * Runs automatically on the first request when the local JSON store is empty,
 * so `npm run dev` gives a populated site with no setup. On Supabase it only
 * runs when you call it explicitly (POST /api/admin/seed) — see
 * docs/SUPABASE_SETUP.md.
 */

interface SeedCreator {
  legacy_id: number;
  name: string;
  handle: string;
  platform: string;
  channel_url: string;
  niche: string;
  category: string;
  tier: string;
  audience: string;
  audience_count: number | null;
  er: string;
  rate_min: number | null;
  rate_max: number | null;
  contact_email: string | null;
  contact_hint: string | null;
  contact_verified: boolean;
  bd_notes: string;
  bio: string;
  photo_url: string | null;
  avatar_url: string | null;
  accent_bg: string;
  emoji: string;
  status: string;
  source: string;
  portfolio: {
    type: string;
    url: string;
    thumbnail: string | null;
    youtube_id: string | null;
    label: string;
    sort_order: number;
  }[];
}

interface SeedCampaign {
  id: number;
  ico: string;
  bg: string;
  brand: string;
  title: string;
  platform: string;
  cat: string;
  spots: string;
  status: string;
  type: string;
  rate: string;
}

let running: Promise<{ seeded: boolean; counts: Record<string, number> }> | null = null;

export async function seedIfEmpty(): Promise<{ seeded: boolean; counts: Record<string, number> }> {
  if (running) return running;
  running = (async () => {
    const existing = await db.count('creators');
    if (existing > 0) return { seeded: false, counts: { creators: existing } };
    return runSeed();
  })();
  const result = await running;
  running = null;
  return result;
}

export async function runSeed(): Promise<{ seeded: boolean; counts: Record<string, number> }> {
  const now = new Date().toISOString();

  // ── Accounts ────────────────────────────────────────────────────────────
  const accounts = [
    {
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
      full_name: 'VEA Admin',
      role: 'admin' as const,
      company_name: 'VEA Group',
      plan: 'pro' as const,
    },
    {
      email: config.seed.brandEmail,
      password: config.seed.brandPassword,
      full_name: 'Demo Brand Manager',
      role: 'brand' as const,
      company_name: 'LuminaSkin',
      plan: 'pro' as const,
    },
    {
      email: 'standard@demo.com',
      password: 'StandardDemo123',
      full_name: 'Standard Plan Brand',
      role: 'brand' as const,
      company_name: 'NoodleCo',
      plan: 'standard' as const,
    },
    {
      email: 'free@demo.com',
      password: 'FreeDemo123',
      full_name: 'Free Plan Brand',
      role: 'brand' as const,
      company_name: 'Trailhead Co',
      plan: 'free' as const,
    },
    {
      email: 'enterprise@demo.com',
      password: 'EnterpriseDemo123',
      full_name: 'Enterprise Plan Brand',
      role: 'brand' as const,
      company_name: 'Northwind Foods',
      plan: 'enterprise' as const,
    },
  ];

  for (const acc of accounts) {
    const exists = await db.findOne('users', { email: acc.email });
    if (exists) continue;
    await db.insert('users', {
      email: acc.email,
      password_hash: hashPassword(acc.password),
      full_name: acc.full_name,
      role: acc.role,
      company_name: acc.company_name,
      country: 'US',
      stripe_customer_id: null,
      plan: acc.plan,
      is_verified: true,
      created_at: now,
    });
  }

  // ── Creators + portfolio (requirement #4: admin pre-loads the roster) ────
  const creators = creatorsData as unknown as SeedCreator[];
  const portfolioRows: Record<string, unknown>[] = [];

  const creatorRows = creators.map((c) => {
    const id = crypto.randomUUID();
    for (const p of c.portfolio ?? []) {
      portfolioRows.push({
        id: crypto.randomUUID(),
        creator_id: id,
        type: p.type,
        url: p.url,
        thumbnail: p.thumbnail,
        youtube_id: p.youtube_id,
        label: p.label,
        sort_order: p.sort_order,
        created_at: now,
      });
    }
    return {
      id,
      legacy_id: c.legacy_id,
      user_id: null,
      name: c.name,
      handle: c.handle,
      platform: c.platform,
      channel_url: c.channel_url,
      niche: c.niche,
      category: c.category,
      tier: c.tier,
      audience: c.audience,
      audience_count: c.audience_count,
      er: c.er,
      rate_min: c.rate_min,
      rate_max: c.rate_max,
      contact_email: c.contact_email,
      contact_hint: c.contact_hint,
      contact_verified: c.contact_verified,
      bd_notes: c.bd_notes,
      bio: c.bio,
      photo_url: c.photo_url,
      avatar_url: c.avatar_url,
      accent_bg: c.accent_bg,
      emoji: c.emoji,
      status: 'active',
      source: 'manual',
      import_batch_id: null,
      created_at: now,
      updated_at: now,
    };
  });

  await db.insertMany('creators', creatorRows as unknown as Partial<Creator>[]);
  await db.insertMany('creator_portfolio', portfolioRows as never[]);

  // ── Open campaigns ──────────────────────────────────────────────────────
  const campaigns = campaignsData as unknown as SeedCampaign[];
  await db.insertMany(
    'campaigns',
    campaigns.map((c) => {
      const spotsLeft = parseInt(c.spots, 10);
      const total = 8;
      return {
        brand_id: null,
        brand_name: c.brand,
        title: c.title,
        category: c.cat,
        content_type: c.type,
        platform: c.platform,
        spots_total: total,
        spots_filled: Number.isFinite(spotsLeft) ? Math.max(0, total - spotsLeft) : 0,
        budget_usd: null,
        rate_label: c.rate,
        brief_text: `${c.brand} is looking for ${c.cat.toLowerCase()} creators to produce ${c.type.toLowerCase()} content for ${c.platform}. Rate: ${c.rate}.`,
        emoji: c.ico,
        accent_bg: c.bg,
        status: 'active' as const,
        published_at: now,
        created_at: now,
      };
    }) as never[],
  );

  // ── Platform settings ───────────────────────────────────────────────────
  // Mirrored from lib/plans.ts so Admin → Settings can display them. These rows
  // are a read-only reflection: the gates themselves always read lib/plans.ts.
  const settings: [string, string][] = [
    ...PLAN_ORDER.flatMap((plan): [string, string][] => [
      [`platform_fee_${plan}`, String(PLANS[plan].feePercent)],
      [`contact_limit_${plan}`, revealLimitLabel(plan)],
    ]),
    ['payment_allowed_countries', config.geo.allowedCountries.join(',')],
  ];
  for (const [key, value] of settings) {
    const exists = await db.findOne('settings', { key });
    if (!exists) await db.insert('settings', { key, value, updated_at: now });
  }

  const counts = {
    users: await db.count('users'),
    creators: await db.count('creators'),
    creator_portfolio: await db.count('creator_portfolio'),
    campaigns: await db.count('campaigns'),
  };

  console.info(
    `[seed] loaded demo data into the ${usingLocalStore() ? 'local JSON store' : 'Supabase database'}:`,
    counts,
  );

  return { seeded: true, counts };
}
