import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { TableName, Tables } from '@/lib/types';
import { applyFilter, matches, type DbDriver, type QueryOptions, type Row } from './driver';

/**
 * Zero-config fallback database.
 *
 * Stores every table in a single JSON file (./.data/db.json) so the whole
 * product — booking, payment, invoices, admin — is usable before any Supabase
 * key exists. Swap-in is automatic: as soon as the Supabase env vars are real,
 * `lib/db/index.ts` picks the Supabase driver instead.
 *
 * Not meant for production traffic: writes are synchronous and serialised.
 */

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

type Store = Record<string, Row[]>;

const EMPTY: Store = {
  users: [],
  creators: [],
  creator_portfolio: [],
  campaigns: [],
  deals: [],
  invoices: [],
  applicants: [],
  partnership_requests: [],
  booking_requests: [],
  contact_messages: [],
  import_batches: [],
  email_log: [],
  saved_creators: [],
  contact_reveals: [],
  upgrade_requests: [],
  settings: [],
};

interface Cache {
  store: Store | null;
  writeQueue: Promise<void>;
}

const g = globalThis as unknown as { __bm_json_store?: Cache };
const cache: Cache = (g.__bm_json_store ??= { store: null, writeQueue: Promise.resolve() });

function load(): Store {
  if (cache.store) return cache.store;
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Store;
      cache.store = { ...structuredClone(EMPTY), ...parsed };
      return cache.store;
    }
  } catch (err) {
    console.error('[json-store] could not read db.json, starting empty:', err);
  }
  cache.store = structuredClone(EMPTY);
  persist();
  return cache.store;
}

function persist(): void {
  const snapshot = JSON.stringify(cache.store, null, 2);
  cache.writeQueue = cache.writeQueue.then(async () => {
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.writeFile(DB_FILE, snapshot, 'utf8');
    } catch (err) {
      console.error('[json-store] write failed:', err);
    }
  });
}

function table(name: string): Row[] {
  const store = load();
  store[name] ??= [];
  return store[name];
}

function sortRows(rows: Row[], orderBy?: string, ascending = true): Row[] {
  if (!orderBy) return rows;
  return [...rows].sort((a, b) => {
    const av = a[orderBy];
    const bv = b[orderBy];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av > bv ? 1 : -1;
    return ascending ? cmp : -cmp;
  });
}

export const jsonStore: DbDriver = {
  name: 'json',

  async list<T extends TableName>(name: T, opts: QueryOptions = {}) {
    let rows = table(name).filter((r) => matches(r, opts.where));
    for (const f of opts.filters ?? []) rows = rows.filter((r) => applyFilter(r, f));
    rows = sortRows(rows, opts.orderBy, opts.ascending ?? true);
    const offset = opts.offset ?? 0;
    const end = opts.limit != null ? offset + opts.limit : undefined;
    return structuredClone(rows.slice(offset, end)) as unknown as Tables[T][];
  },

  async get<T extends TableName>(name: T, id: string) {
    const row = table(name).find((r) => r.id === id);
    return row ? (structuredClone(row) as unknown as Tables[T]) : null;
  },

  async findOne<T extends TableName>(name: T, where: Record<string, unknown>) {
    const row = table(name).find((r) => matches(r, where));
    return row ? (structuredClone(row) as unknown as Tables[T]) : null;
  },

  async count<T extends TableName>(name: T, where: Record<string, unknown> = {}) {
    return table(name).filter((r) => matches(r, where)).length;
  },

  async insert<T extends TableName>(name: T, data: Partial<Tables[T]>) {
    const row: Row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...(data as Row),
    };
    table(name).push(row);
    persist();
    return structuredClone(row) as unknown as Tables[T];
  },

  async insertMany<T extends TableName>(name: T, rows: Partial<Tables[T]>[]) {
    const created = rows.map((data) => ({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...(data as Row),
    }));
    table(name).push(...created);
    persist();
    return structuredClone(created) as unknown as Tables[T][];
  },

  async update<T extends TableName>(name: T, id: string, data: Partial<Tables[T]>) {
    const rows = table(name);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...(data as Row) };
    persist();
    return structuredClone(rows[i]) as unknown as Tables[T];
  },

  async remove<T extends TableName>(name: T, id: string) {
    const rows = table(name);
    const i = rows.findIndex((r) => r.id === id);
    if (i !== -1) {
      rows.splice(i, 1);
      persist();
    }
  },
};

/** True when the store has never been seeded. */
export function isEmpty(): boolean {
  return table('creators').length === 0 && table('users').length === 0;
}

/** Used by the seeder to wipe and reload demo data. */
export function resetStore(): void {
  cache.store = structuredClone(EMPTY);
  persist();
}
