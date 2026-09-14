import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

/**
 * Merge the local JSON store into Supabase.
 *
 * The local store uses generated UUIDs, while the hosted seed can have its
 * own UUIDs.  This script therefore maps foreign keys as it goes instead of
 * blindly inserting db.json and creating a second copy of the seed data.
 *
 * Default mode is a read-only plan. Use --apply to write.
 * Run with: node --env-file=.env.local scripts/migrate-json-to-supabase.mjs --apply
 */

const ROOT = process.cwd();
const DB_FILE = path.join(ROOT, '.data', 'db.json');
const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 1000;

const TABLES = [
  'users',
  'brands',
  'creators',
  'creator_portfolio',
  'campaigns',
  'deals',
  'invoices',
  'applicants',
  'partnership_requests',
  'booking_requests',
  'contact_messages',
  'import_batches',
  'email_log',
  'saved_creators',
  'contact_reveals',
  'upgrade_requests',
  'settings',
  'news_posts',
  'showcase_cases',
];

const ID_MAPS = Object.fromEntries(TABLES.map((table) => [table, new Map()]));
const REMOTE_IDS = Object.fromEntries(TABLES.map((table) => [table, new Set()]));
const warnings = [];
const stats = [];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeHandle(value) {
  const handle = normalize(value);
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function keyParts(...parts) {
  return parts.map((part) => normalize(part)).join('\u0000');
}

function creatorKey(row) {
  return keyParts(row.platform, normalizeHandle(row.handle));
}

function clean(row, excluded = []) {
  const skip = new Set(excluded);
  return Object.fromEntries(
    Object.entries(row).filter(([key, value]) => !skip.has(key) && value !== undefined),
  );
}

function localRows(store, table) {
  return Array.isArray(store[table]) ? store[table] : [];
}

function remoteIdSet(rows) {
  return new Set(rows.map((row) => row.id).filter(Boolean));
}

function mapForeign(table, value, field, required = false) {
  if (value == null || value === '') return null;
  const mapped = ID_MAPS[table].get(value);
  if (mapped) return mapped;

  // A local JSON row can legitimately point at a row created remotely (for
  // example, an import batch recorded by the hosted admin user). Keep that
  // UUID instead of silently turning the relationship into null.
  if (REMOTE_IDS[table]?.has(value)) return value;

  const message = `Could not map ${field}=${value} to ${table}`;
  if (required) throw new Error(message);
  warnings.push(message);
  return null;
}

function mapAnyForeign(value) {
  if (value == null || value === '') return value ?? null;
  for (const map of Object.values(ID_MAPS)) {
    if (map.has(value)) return map.get(value);
  }
  return value;
}

async function loadStore() {
  const text = await fs.readFile(DB_FILE, 'utf8');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error(`${DB_FILE} is not a JSON object.`);
  return parsed;
}

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAll(client, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`[${table}] read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function insertRow(client, table, payload) {
  const { data, error } = await client.from(table).insert(payload).select('*').single();
  if (error) throw new Error(`[${table}] insert failed: ${error.message}`);
  return data;
}

async function updateRow(client, table, id, payload) {
  const { data, error } = await client
    .from(table)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`[${table}] update ${id} failed: ${error.message}`);
  return data;
}

/**
 * Merge a collection using a natural key. New rows keep their local UUID when
 * it is not already used remotely, which makes a second run idempotent even
 * for tables that do not have a business unique constraint.
 */
async function mergeCollection({
  client,
  table,
  local,
  remote,
  keyOf,
  insertPayload,
  updatePayload = insertPayload,
  map = ID_MAPS[table],
  preserveLocalId = true,
}) {
  const byKey = new Map();
  const byId = new Map();
  for (const row of remote) {
    byKey.set(keyOf(row), row);
    if (row.id) byId.set(row.id, row);
  }

  const result = { table, local: local.length, add: 0, update: 0, unchanged: 0 };

  for (const row of local) {
    const key = keyOf(row);
    let existing = byKey.get(key);

    // For id-only collections, the id is the natural key. For business-key
    // collections, never accidentally overwrite a different remote row just
    // because a generated local UUID happens to collide.
    if (!existing && key === row.id) existing = byId.get(row.id);

    if (existing) {
      const payload = updatePayload(row);
      const changed = Object.entries(payload).some(([field, value]) => {
        // Timestamps are bookkeeping fields. A hosted trigger may rewrite
        // updated_at, and created_at can have a different ISO representation,
        // but neither difference means the business row needs rewriting.
        if (field === 'created_at' || field === 'updated_at') return false;
        return JSON.stringify(existing[field]) !== JSON.stringify(value);
      });
      if (!changed) {
        result.unchanged += 1;
        if (row.id) map.set(row.id, existing.id);
        continue;
      }
      result.update += 1;
      const updated = APPLY ? await updateRow(client, table, existing.id, payload) : { ...existing, ...payload };
      byKey.set(key, updated);
      byId.set(updated.id, updated);
      if (row.id) map.set(row.id, updated.id);
      continue;
    }

    const preferredId = preserveLocalId && row.id && !byId.has(row.id) ? row.id : undefined;
    const payload = {
      ...insertPayload(row),
      ...(preferredId ? { id: preferredId } : {}),
    };
    result.add += 1;
    const inserted = APPLY ? await insertRow(client, table, payload) : { ...payload };
    byKey.set(key, inserted);
    if (inserted.id) byId.set(inserted.id, inserted);
    if (row.id && inserted.id) map.set(row.id, inserted.id);
  }

  stats.push(result);
}

function printStats(title) {
  console.log(`\n${title}`);
  for (const item of stats) {
    console.log(
      `  ${item.table.padEnd(22)} local=${String(item.local).padStart(3)}  add=${String(item.add).padStart(3)}  update=${String(item.update).padStart(3)}  unchanged=${String(item.unchanged).padStart(3)}`,
    );
  }
}

async function main() {
  const store = await loadStore();
  const client = createSupabase();
  const remote = {};

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'}: ${DB_FILE} -> Supabase`);
  console.log('Reading remote tables...');
  for (const table of TABLES) remote[table] = await fetchAll(client, table);
  for (const table of TABLES) {
    for (const row of remote[table]) if (row.id) REMOTE_IDS[table].add(row.id);
  }

  console.log('\nRemote rows before merge:');
  for (const table of TABLES) {
    const count = remote[table].length;
    const localCount = localRows(store, table).length;
    if (localCount || count) console.log(`  ${table.padEnd(22)} ${count}`);
  }

  // Users are the root of the application graph. Match case-insensitively by
  // email so the local UUIDs can safely point to the hosted UUIDs.
  await mergeCollection({
    client,
    table: 'users',
    local: localRows(store, 'users'),
    remote: remote.users,
    keyOf: (row) => normalize(row.email),
    insertPayload: (row) => clean(row, ['id']),
    updatePayload: (row) => clean(row, ['id', 'email']),
  });

  await mergeCollection({
    client,
    table: 'import_batches',
    local: localRows(store, 'import_batches'),
    remote: remote.import_batches,
    keyOf: (row) => row.id,
    insertPayload: (row) => ({ ...clean(row, ['id']), imported_by: mapForeign('users', row.imported_by, 'imported_by') }),
    updatePayload: (row) => ({ ...clean(row, ['id']), imported_by: mapForeign('users', row.imported_by, 'imported_by') }),
  });

  await mergeCollection({
    client,
    table: 'creators',
    local: localRows(store, 'creators'),
    remote: remote.creators,
    keyOf: creatorKey,
    insertPayload: (row) => ({
      ...clean(row, ['id']),
      handle: normalizeHandle(row.handle),
      user_id: mapForeign('users', row.user_id, 'user_id'),
      import_batch_id: mapForeign('import_batches', row.import_batch_id, 'import_batch_id'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id']),
      handle: normalizeHandle(row.handle),
      user_id: mapForeign('users', row.user_id, 'user_id'),
      import_batch_id: mapForeign('import_batches', row.import_batch_id, 'import_batch_id'),
    }),
  });

  await mergeCollection({
    client,
    table: 'brands',
    local: localRows(store, 'brands'),
    remote: remote.brands,
    keyOf: (row) => keyParts(mapForeign('users', row.user_id, 'user_id')),
    insertPayload: (row) => ({ ...clean(row, ['id', 'user_id']), user_id: mapForeign('users', row.user_id, 'user_id', true) }),
    updatePayload: (row) => ({ ...clean(row, ['id', 'user_id']), user_id: mapForeign('users', row.user_id, 'user_id', true) }),
  });

  await mergeCollection({
    client,
    table: 'campaigns',
    local: localRows(store, 'campaigns'),
    remote: remote.campaigns,
    keyOf: (row) => keyParts(row.brand_name, row.title),
    insertPayload: (row) => ({ ...clean(row, ['id']), brand_id: mapForeign('users', row.brand_id, 'brand_id') }),
    updatePayload: (row) => ({ ...clean(row, ['id']), brand_id: mapForeign('users', row.brand_id, 'brand_id') }),
  });

  await mergeCollection({
    client,
    table: 'news_posts',
    local: localRows(store, 'news_posts'),
    remote: remote.news_posts,
    keyOf: (row) => normalize(row.slug),
    insertPayload: (row) => clean(row, ['id']),
    updatePayload: (row) => clean(row, ['id']),
  });

  await mergeCollection({
    client,
    table: 'showcase_cases',
    local: localRows(store, 'showcase_cases'),
    remote: remote.showcase_cases,
    keyOf: (row) => normalize(row.slug),
    insertPayload: (row) => clean(row, ['id']),
    updatePayload: (row) => clean(row, ['id']),
  });

  await mergeCollection({
    client,
    table: 'creator_portfolio',
    local: localRows(store, 'creator_portfolio'),
    remote: remote.creator_portfolio,
    keyOf: (row) => keyParts(
      mapForeign('creators', row.creator_id, 'creator_id'),
      row.type,
      row.url,
      row.sort_order,
    ),
    insertPayload: (row) => ({
      ...clean(row, ['id', 'creator_id']),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id', true),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id', 'creator_id']),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id', true),
    }),
  });

  await mergeCollection({
    client,
    table: 'applicants',
    local: localRows(store, 'applicants'),
    remote: remote.applicants,
    keyOf: (row) => row.id,
    insertPayload: (row) => ({
      ...clean(row, ['id']),
      campaign_id: mapForeign('campaigns', row.campaign_id, 'campaign_id'),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id']),
      campaign_id: mapForeign('campaigns', row.campaign_id, 'campaign_id'),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id'),
    }),
  });

  await mergeCollection({
    client,
    table: 'deals',
    local: localRows(store, 'deals'),
    remote: remote.deals,
    keyOf: (row) => normalize(row.deal_ref),
    insertPayload: (row) => ({
      ...clean(row, ['id']),
      campaign_id: mapForeign('campaigns', row.campaign_id, 'campaign_id'),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id', true),
      brand_id: mapForeign('users', row.brand_id, 'brand_id'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id']),
      campaign_id: mapForeign('campaigns', row.campaign_id, 'campaign_id'),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id', true),
      brand_id: mapForeign('users', row.brand_id, 'brand_id'),
    }),
  });

  await mergeCollection({
    client,
    table: 'invoices',
    local: localRows(store, 'invoices'),
    remote: remote.invoices,
    keyOf: (row) => normalize(row.invoice_no),
    insertPayload: (row) => ({
      ...clean(row, ['id']),
      deal_id: mapForeign('deals', row.deal_id, 'deal_id', true),
      brand_id: mapForeign('users', row.brand_id, 'brand_id'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id']),
      deal_id: mapForeign('deals', row.deal_id, 'deal_id', true),
      brand_id: mapForeign('users', row.brand_id, 'brand_id'),
    }),
  });

  await mergeCollection({
    client,
    table: 'partnership_requests',
    local: localRows(store, 'partnership_requests'),
    remote: remote.partnership_requests,
    keyOf: (row) => row.id,
    insertPayload: (row) => ({ ...clean(row, ['id']), assigned_to: mapForeign('users', row.assigned_to, 'assigned_to') }),
    updatePayload: (row) => ({ ...clean(row, ['id']), assigned_to: mapForeign('users', row.assigned_to, 'assigned_to') }),
  });

  await mergeCollection({
    client,
    table: 'booking_requests',
    local: localRows(store, 'booking_requests'),
    remote: remote.booking_requests,
    keyOf: (row) => normalize(row.request_ref),
    insertPayload: (row) => ({
      ...clean(row, ['id']),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id'),
      campaign_id: mapForeign('campaigns', row.campaign_id, 'campaign_id'),
      handled_by: mapForeign('users', row.handled_by, 'handled_by'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id']),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id'),
      campaign_id: mapForeign('campaigns', row.campaign_id, 'campaign_id'),
      handled_by: mapForeign('users', row.handled_by, 'handled_by'),
    }),
  });

  await mergeCollection({
    client,
    table: 'contact_messages',
    local: localRows(store, 'contact_messages'),
    remote: remote.contact_messages,
    keyOf: (row) => row.id,
    insertPayload: (row) => clean(row, ['id']),
    updatePayload: (row) => clean(row, ['id']),
  });

  await mergeCollection({
    client,
    table: 'email_log',
    local: localRows(store, 'email_log'),
    remote: remote.email_log,
    keyOf: (row) => row.id,
    insertPayload: (row) => ({ ...clean(row, ['id']), related_id: mapAnyForeign(row.related_id) }),
    updatePayload: (row) => ({ ...clean(row, ['id']), related_id: mapAnyForeign(row.related_id) }),
  });

  await mergeCollection({
    client,
    table: 'saved_creators',
    local: localRows(store, 'saved_creators'),
    remote: remote.saved_creators,
    keyOf: (row) => keyParts(
      mapForeign('users', row.user_id, 'user_id'),
      mapForeign('creators', row.creator_id, 'creator_id'),
    ),
    insertPayload: (row) => ({
      ...clean(row, ['id', 'user_id', 'creator_id']),
      user_id: mapForeign('users', row.user_id, 'user_id', true),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id', true),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id', 'user_id', 'creator_id']),
      user_id: mapForeign('users', row.user_id, 'user_id', true),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id', true),
    }),
  });

  await mergeCollection({
    client,
    table: 'contact_reveals',
    local: localRows(store, 'contact_reveals'),
    remote: remote.contact_reveals,
    keyOf: (row) => keyParts(
      mapForeign('users', row.user_id, 'user_id'),
      mapForeign('creators', row.creator_id, 'creator_id'),
      mapForeign('applicants', row.applicant_id, 'applicant_id'),
      row.reveal_date,
    ),
    insertPayload: (row) => ({
      ...clean(row, ['id', 'user_id', 'creator_id', 'applicant_id']),
      user_id: mapForeign('users', row.user_id, 'user_id', true),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id'),
      applicant_id: mapForeign('applicants', row.applicant_id, 'applicant_id'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id', 'user_id', 'creator_id', 'applicant_id']),
      user_id: mapForeign('users', row.user_id, 'user_id', true),
      creator_id: mapForeign('creators', row.creator_id, 'creator_id'),
      applicant_id: mapForeign('applicants', row.applicant_id, 'applicant_id'),
    }),
  });

  await mergeCollection({
    client,
    table: 'upgrade_requests',
    local: localRows(store, 'upgrade_requests'),
    remote: remote.upgrade_requests,
    keyOf: (row) => keyParts(
      mapForeign('users', row.user_id, 'user_id'),
      row.to_plan,
      row.status,
      row.created_at,
    ),
    insertPayload: (row) => ({
      ...clean(row, ['id', 'user_id', 'decided_by']),
      user_id: mapForeign('users', row.user_id, 'user_id', true),
      decided_by: mapForeign('users', row.decided_by, 'decided_by'),
    }),
    updatePayload: (row) => ({
      ...clean(row, ['id', 'user_id', 'decided_by']),
      user_id: mapForeign('users', row.user_id, 'user_id', true),
      decided_by: mapForeign('users', row.decided_by, 'decided_by'),
    }),
  });

  await mergeCollection({
    client,
    table: 'settings',
    local: localRows(store, 'settings'),
    remote: remote.settings,
    keyOf: (row) => normalize(row.key),
    // json-store adds created_at to every inserted row, but settings only has
    // id, key, value and updated_at in the hosted schema.
    insertPayload: (row) => clean(row, ['id', 'created_at']),
    updatePayload: (row) => clean(row, ['id', 'created_at']),
  });

  printStats(APPLY ? 'Rows written:' : 'Planned merge:');

  if (warnings.length) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`  - ${warning}`);
  }

  if (!APPLY) {
    console.log('\nRead-only plan complete. Run the same command with --apply to write these changes.');
    return;
  }

  console.log('\nVerifying hosted counts...');
  for (const table of TABLES) {
    const count = localRows(store, table).length;
    if (!count) continue;
    const rows = await fetchAll(client, table);
    console.log(`  ${table.padEnd(22)} ${rows.length}`);
  }
  console.log('\nSupabase merge completed. No remote rows were deleted.');
}

main().catch((error) => {
  console.error(`\nMigration stopped: ${error.message}`);
  process.exitCode = 1;
});
