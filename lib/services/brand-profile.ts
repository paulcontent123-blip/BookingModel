import 'server-only';

import { db } from '@/lib/db';
import type { Brand, Role, User } from '@/lib/types';

export async function getBrandByUserId(userId: string): Promise<Brand | null> {
  return db.findOne('brands', { user_id: userId });
}

export async function getBrandById(id: string): Promise<Brand | null> {
  return db.get('brands', id);
}

export async function listAllBrands(): Promise<Brand[]> {
  return db.list('brands', { orderBy: 'created_at', ascending: false, limit: 10000 });
}

/** Creates the profile lazily for legacy and newly registered brand users. */
export async function ensureBrandProfile(
  user: Pick<User, 'id' | 'email' | 'full_name' | 'company_name' | 'country'>,
): Promise<Brand> {
  const existing = await getBrandByUserId(user.id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const fallbackName =
    user.company_name?.trim() ||
    user.full_name?.trim() ||
    user.email.split('@')[0] ||
    'New brand';

  try {
    return await db.insert('brands', {
      user_id: user.id,
      brand_name: fallbackName,
      legal_name: null,
      website: null,
      industry: null,
      description: null,
      company_size: null,
      country: user.country?.trim() || 'US',
      state: null,
      city: null,
      timezone: null,
      contact_name: user.full_name,
      contact_email: user.email,
      contact_phone: null,
      linkedin_url: null,
      instagram_url: null,
      tiktok_url: null,
      avatar_url: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    // Two concurrent requests can both observe the missing row. The unique
    // user_id constraint makes one insert fail; return the winner's row.
    const concurrent = await getBrandByUserId(user.id);
    if (concurrent) return concurrent;
    throw error;
  }
}

/** Backfills one profile per existing brand/agency account for Admin. */
export async function ensureBrandProfilesForExistingUsers(): Promise<void> {
  const users = await db.list('users', { limit: 10000 });
  const brandRoles: Role[] = ['brand', 'agency'];
  for (const user of users) {
    if (brandRoles.includes(user.role)) await ensureBrandProfile(user);
  }
}
