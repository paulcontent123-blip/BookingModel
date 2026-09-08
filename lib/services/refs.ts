import 'server-only';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import type { TableName } from '@/lib/types';

/**
 * Human-readable sequential references (BM-2026-0001).
 *
 * The JSON store has no sequences, so we derive the next number from the
 * highest existing reference. On Supabase the UNIQUE constraint on the column
 * is the real guard — a collision under concurrency retries with the next
 * number rather than failing the booking.
 */
async function nextNumber(table: TableName, column: string, prefix: string): Promise<number> {
  const rows = (await db.list(table, { limit: 1000 })) as unknown as Record<string, unknown>[];
  const year = new Date().getFullYear();
  const head = `${prefix}-${year}-`;
  let max = 0;
  for (const row of rows) {
    const value = String(row[column] ?? '');
    if (!value.startsWith(head)) continue;
    const n = parseInt(value.slice(head.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

function format(prefix: string, n: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

export async function nextDealRef(): Promise<string> {
  const prefix = config.payments.invoicePrefix;
  return format(prefix, await nextNumber('deals', 'deal_ref', prefix));
}

export async function nextInvoiceNo(): Promise<string> {
  const prefix = `${config.payments.invoicePrefix}-INV`;
  return format(prefix, await nextNumber('invoices', 'invoice_no', prefix));
}

export async function nextRequestRef(): Promise<string> {
  const prefix = `${config.payments.invoicePrefix}-REQ`;
  return format(prefix, await nextNumber('booking_requests', 'request_ref', prefix));
}
