-- ---------------------------------------------------------------------------
-- Plan tiers, tiered platform fees and the plan upgrade flow.
--
-- 1. adds the Enterprise tier to users.plan
-- 2. records the fee rate that was actually charged on each deal / invoice, so
--    a historical document never re-renders at today's rate
-- 3. adds upgrade_requests — the sales-led / no-Stripe path to a higher plan
-- 4. contact_reveals becomes one row per (user, creator, day) so the daily
--    quota counts distinct creators instead of clicks
-- ---------------------------------------------------------------------------

-- ── 1. Enterprise tier ─────────────────────────────────────────────────────
alter table public.users drop constraint if exists users_plan_check;
alter table public.users
  add constraint users_plan_check
  check (plan in ('free','standard','pro','enterprise'));

-- ── 2. Fee rate charged, per document ──────────────────────────────────────
alter table public.deals
  add column if not exists platform_fee_percent numeric(5,2) not null default 15;
alter table public.invoices
  add column if not exists platform_fee_percent numeric(5,2) not null default 15;

-- Backfill from the amounts already stored; leaves the default in place when
-- the subtotal is zero.
update public.deals
   set platform_fee_percent = round((platform_fee_usd::numeric * 100) / subtotal_usd, 2)
 where subtotal_usd > 0;

update public.invoices
   set platform_fee_percent = round((platform_fee_usd::numeric * 100) / subtotal_usd, 2)
 where subtotal_usd > 0;

-- ── 3. Upgrade requests ────────────────────────────────────────────────────
create table if not exists public.upgrade_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  user_email          text not null,
  company_name        text,
  from_plan           text not null check (from_plan in ('free','standard','pro','enterprise')),
  to_plan             text not null check (to_plan   in ('free','standard','pro','enterprise')),
  source              text not null default 'self_serve' check (source in ('self_serve','sales')),
  status              text not null default 'pending'
                      check (status in ('pending','approved','rejected','cancelled')),
  note                text,
  checkout_session_id text,
  decided_by          uuid references public.users(id) on delete set null,
  decided_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists upgrade_requests_status_idx
  on public.upgrade_requests (status, created_at desc);

-- One open request per brand: a second click must not queue a duplicate.
create unique index if not exists upgrade_requests_one_open_idx
  on public.upgrade_requests (user_id)
  where status = 'pending';

alter table public.upgrade_requests enable row level security;

-- ── 4. One reveal per creator per day ──────────────────────────────────────
-- Re-opening a creator already revealed today must not consume more quota.
alter table public.contact_reveals
  add column if not exists reveal_date date not null default current_date;

update public.contact_reveals
   set reveal_date = (created_at at time zone 'utc')::date
 where reveal_date is distinct from (created_at at time zone 'utc')::date;

-- Collapse any duplicates left by the previous unconstrained inserts.
delete from public.contact_reveals a
 using public.contact_reveals b
 where a.user_id = b.user_id
   and a.creator_id = b.creator_id
   and a.reveal_date = b.reveal_date
   and a.ctid > b.ctid;

create unique index if not exists contact_reveals_user_creator_day_idx
  on public.contact_reveals (user_id, creator_id, reveal_date);
