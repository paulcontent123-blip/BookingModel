import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import type { TableName, Tables } from '@/lib/types';
import type { DbDriver, QueryOptions } from './driver';

/**
 * Supabase driver — used automatically once NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY hold real values (see docs/SUPABASE_SETUP.md).
 *
 * Runs with the service-role key on the server only. Row Level Security still
 * protects anything that reaches the browser through the anon key.
 */

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Browser-safe client (anon key, respects RLS). */
export function supabasePublic(): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  });
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`[supabase] ${context}: ${error.message}`);
}

export const supabaseStore: DbDriver = {
  name: 'supabase',

  async list<T extends TableName>(name: T, opts: QueryOptions = {}) {
    let q = supabaseAdmin().from(name).select('*');

    for (const [col, val] of Object.entries(opts.where ?? {})) q = q.eq(col, val as never);

    for (const f of opts.filters ?? []) {
      switch (f.op) {
        case 'eq': q = q.eq(f.column, f.value as never); break;
        case 'neq': q = q.neq(f.column, f.value as never); break;
        case 'gt': q = q.gt(f.column, f.value as never); break;
        case 'gte': q = q.gte(f.column, f.value as never); break;
        case 'lt': q = q.lt(f.column, f.value as never); break;
        case 'lte': q = q.lte(f.column, f.value as never); break;
        case 'in': q = q.in(f.column, f.value as never[]); break;
        case 'like': q = q.ilike(f.column, `%${String(f.value)}%`); break;
      }
    }

    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? true });

    const offset = opts.offset ?? 0;
    if (opts.limit != null) q = q.range(offset, offset + opts.limit - 1);
    else if (offset) q = q.range(offset, offset + 999);

    const { data, error } = await q;
    fail(`list ${name}`, error);
    return (data ?? []) as Tables[T][];
  },

  async get<T extends TableName>(name: T, id: string) {
    const { data, error } = await supabaseAdmin().from(name).select('*').eq('id', id).maybeSingle();
    fail(`get ${name}`, error);
    return (data ?? null) as Tables[T] | null;
  },

  async findOne<T extends TableName>(name: T, where: Record<string, unknown>) {
    let q = supabaseAdmin().from(name).select('*');
    for (const [col, val] of Object.entries(where)) q = q.eq(col, val as never);
    const { data, error } = await q.limit(1).maybeSingle();
    fail(`findOne ${name}`, error);
    return (data ?? null) as Tables[T] | null;
  },

  async count<T extends TableName>(name: T, where: Record<string, unknown> = {}) {
    let q = supabaseAdmin().from(name).select('id', { count: 'exact', head: true });
    for (const [col, val] of Object.entries(where)) q = q.eq(col, val as never);
    const { count, error } = await q;
    fail(`count ${name}`, error);
    return count ?? 0;
  },

  async insert<T extends TableName>(name: T, data: Partial<Tables[T]>) {
    const { data: row, error } = await supabaseAdmin()
      .from(name)
      .insert(data as never)
      .select()
      .single();
    fail(`insert ${name}`, error);
    return row as Tables[T];
  },

  async insertMany<T extends TableName>(name: T, rows: Partial<Tables[T]>[]) {
    if (!rows.length) return [];
    const { data, error } = await supabaseAdmin()
      .from(name)
      .insert(rows as never)
      .select();
    fail(`insertMany ${name}`, error);
    return (data ?? []) as Tables[T][];
  },

  async update<T extends TableName>(name: T, id: string, data: Partial<Tables[T]>) {
    const { data: row, error } = await supabaseAdmin()
      .from(name)
      .update(data as never)
      .eq('id', id)
      .select()
      .maybeSingle();
    fail(`update ${name}`, error);
    return (row ?? null) as Tables[T] | null;
  },

  async remove<T extends TableName>(name: T, id: string) {
    const { error } = await supabaseAdmin().from(name).delete().eq('id', id);
    fail(`remove ${name}`, error);
  },
};
