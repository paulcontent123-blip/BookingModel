import 'server-only';

import { db } from '@/lib/db';
import type { Creator } from '@/lib/types';

export interface CreatorListOptions {
  /** Public-facing views should normally set this to true. */
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * The single read path for creator lists shown by the application.
 *
 * This deliberately reads through the configured database driver (Supabase in
 * production and local development alike. Static seed JSON is not rendered
 * directly and is not used to populate a local fallback store.
 */
export async function listCreatorsFromDatabase(
  { activeOnly = false, limit, offset }: CreatorListOptions = {},
): Promise<Creator[]> {
  return db.list('creators', {
    ...(activeOnly ? { where: { status: 'active' } } : {}),
    orderBy: 'legacy_id',
    ...(limit == null ? {} : { limit }),
    ...(offset == null ? {} : { offset }),
  });
}

/** Single-record counterpart used by creator profile/detail views. */
export function getCreatorFromDatabase(id: string): Promise<Creator | null> {
  return db.get('creators', id);
}
