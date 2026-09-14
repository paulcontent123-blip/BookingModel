import 'server-only';
import { config } from '@/lib/config';
import type { DbDriver } from './driver';
import { supabaseStore } from './supabase-store';

export type { DbDriver, QueryOptions, Filter } from './driver';

/**
 * The application uses the hosted database as its only runtime data source.
 * A missing Supabase configuration is an installation error, not a reason to
 * silently create a second local database with stale demo data.
 */
if (!config.supabase.enabled) {
  throw new Error(
    'Supabase is required. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before starting BookingModel.',
  );
}

export const db: DbDriver = supabaseStore;

export const dbDriverName = db.name;

export function usingLocalStore(): boolean {
  return false;
}
