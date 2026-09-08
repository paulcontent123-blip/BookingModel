import type { TableName, Tables } from '@/lib/types';

export type Row = Record<string, unknown>;

export type Comparator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';

export interface Filter {
  column: string;
  op: Comparator;
  value: unknown;
}

export interface QueryOptions {
  /** Shorthand equality filters: { status: 'active' } */
  where?: Record<string, unknown>;
  /** Richer filters when equality is not enough. */
  filters?: Filter[];
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Minimal repository surface implemented by both the local JSON store and the
 * Supabase client, so application code never branches on the driver.
 */
export interface DbDriver {
  readonly name: string;
  list<T extends TableName>(table: T, opts?: QueryOptions): Promise<Tables[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null>;
  findOne<T extends TableName>(
    table: T,
    where: Record<string, unknown>,
  ): Promise<Tables[T] | null>;
  count<T extends TableName>(table: T, where?: Record<string, unknown>): Promise<number>;
  insert<T extends TableName>(table: T, data: Partial<Tables[T]>): Promise<Tables[T]>;
  insertMany<T extends TableName>(
    table: T,
    rows: Partial<Tables[T]>[],
  ): Promise<Tables[T][]>;
  update<T extends TableName>(
    table: T,
    id: string,
    data: Partial<Tables[T]>,
  ): Promise<Tables[T] | null>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
}

export function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

export function applyFilter(row: Row, f: Filter): boolean {
  const v = row[f.column];
  switch (f.op) {
    case 'eq':
      return v === f.value;
    case 'neq':
      return v !== f.value;
    case 'gt':
      return (v as number) > (f.value as number);
    case 'gte':
      return (v as number) >= (f.value as number);
    case 'lt':
      return (v as number) < (f.value as number);
    case 'lte':
      return (v as number) <= (f.value as number);
    case 'in':
      return Array.isArray(f.value) && f.value.includes(v as never);
    case 'like':
      return String(v ?? '')
        .toLowerCase()
        .includes(String(f.value).toLowerCase());
    default:
      return true;
  }
}
