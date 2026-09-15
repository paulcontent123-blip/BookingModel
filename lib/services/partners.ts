import 'server-only';

import { db } from '@/lib/db';
import type { Partner } from '@/lib/types';

function byDisplayOrder(a: Partner, b: Partner): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

/** Only published partner profiles are ever exposed on the public site. */
export async function listPublishedPartners(limit?: number): Promise<Partner[]> {
  const partners = await db.list('partners', {
    where: { status: 'published' },
    limit: 500,
  });
  const sorted = partners.sort(byDisplayOrder);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Admin view, including drafts and hidden partner profiles. */
export async function listAllPartners(): Promise<Partner[]> {
  const partners = await db.list('partners', { limit: 500 });
  return partners.sort(byDisplayOrder);
}

export async function getPartner(id: string): Promise<Partner | null> {
  return db.get('partners', id);
}
