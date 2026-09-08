import 'server-only';
import { config } from '@/lib/config';
import type { DbDriver } from './driver';
import { jsonStore } from './json-store';
import { supabaseStore } from './supabase-store';

export type { DbDriver, QueryOptions, Filter } from './driver';

/**
 * The one place the storage backend is chosen.
 *
 *   Supabase keys present -> real PostgreSQL
 *   otherwise             -> ./.data/db.json (works out of the box)
 */
export const db: DbDriver = config.supabase.enabled ? supabaseStore : jsonStore;

export const dbDriverName = db.name;

export function usingLocalStore(): boolean {
  return db.name === 'json';
}
