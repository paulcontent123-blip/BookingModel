-- ===========================================================================
-- Migration: initial_schema
-- Created:   2026-09-04
--
-- Creates all 15 tables for BookingModel.com.
-- Applied with:  npx supabase db push
-- Idempotent: every object uses IF NOT EXISTS, so re-running is safe.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ── users ──────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique not null,
  password_hash      text,
  full_name          text,
  role               text not null default 'brand'
                     check (role in ('creator','brand','agency','admin')),
  company_name       text,
  country            text,
  stripe_customer_id text,
  plan               text not null default 'free'
                     check (plan in ('free','standard','pro')),
  is_verified        boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists users_email_idx on public.users (lower(email));

-- ── creators ───────────────────────────────────────────────────────────────
create table if not exists public.creators (
  id               uuid primary key default gen_random_uuid(),
  legacy_id        integer,
  user_id          uuid references public.users(id) on delete set null,
  name             text not null,
  handle           text unique not null,
  platform         text not null,
  channel_url      text,
  niche            text,
  category         text,
  tier             text,
  audience         text,
  audience_count   bigint,
  er               text,
  rate_min         integer,          -- whole USD
  rate_max         integer,
  contact_email    text,
  contact_hint     text,
  contact_verified boolean not null default false,
  bd_notes         text,
  bio              text,
  photo_url        text,
  avatar_url       text,
  accent_bg        text,
  emoji            text,
  status           text not null default 'pending'
                   check (status in ('pending','active','inactive','rejected')),
  source           text not null default 'manual'
                   check (source in ('manual','csv_import','self_apply','crawl')),
  import_batch_id  uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists creators_status_idx   on public.creators (status);
create index if not exists creators_platform_idx on public.creators (platform);
create index if not exists creators_category_idx on public.creators (category);

-- ── creator_portfolio ──────────────────────────────────────────────────────
create table if not exists public.creator_portfolio (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  type       text not null check (type in ('image','video')),
  url        text not null,
  thumbnail  text,
  youtube_id text,
  label      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_creator_idx on public.creator_portfolio (creator_id);

-- ── campaigns ──────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid references public.users(id) on delete set null,
  brand_name   text,
  title        text not null,
  category     text,
  content_type text,
  platform     text,
  spots_total  integer not null default 5,
  spots_filled integer not null default 0,
  budget_usd   integer,
  rate_label   text,
  brief_text   text,
  emoji        text,
  accent_bg    text,
  status       text not null default 'draft'
               check (status in ('draft','active','paused','completed')),
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ── deals (bookings) ───────────────────────────────────────────────────────
create table if not exists public.deals (
  id                 uuid primary key default gen_random_uuid(),
  deal_ref           text unique not null,           -- BM-2026-0001
  campaign_id        uuid references public.campaigns(id) on delete set null,
  creator_id         uuid not null references public.creators(id) on delete restrict,
  brand_id           uuid references public.users(id) on delete set null,
  brand_name         text,
  brand_email        text,
  content_type       text,
  deliverables       text,
  quantity           integer not null default 1,
  unit_price_usd     integer not null default 0,
  subtotal_usd       integer not null default 0,
  platform_fee_usd   integer not null default 0,
  tax_usd            integer not null default 0,
  total_usd          integer not null default 0,
  currency           text not null default 'USD',
  status             text not null default 'negotiating'
                     check (status in ('pending_payment','negotiating','brief_sent',
                       'content_in_review','approved','published','completed',
                       'overdue','cancelled')),
  payment_status     text not null default 'unpaid'
                     check (payment_status in ('unpaid','paid','refunded','failed')),
  payment_provider   text,
  payment_ref        text,
  due_date           date,
  brief              text,
  notes              text,
  origin_country     text,                            -- geo audit trail
  creator_notified_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists deals_creator_idx on public.deals (creator_id);
create index if not exists deals_brand_idx   on public.deals (brand_id);
create index if not exists deals_status_idx  on public.deals (status);

-- ── invoices ───────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_no       text unique not null,             -- BM-INV-2026-0001
  deal_id          uuid not null references public.deals(id) on delete cascade,
  brand_id         uuid references public.users(id) on delete set null,
  bill_to_name     text not null,
  bill_to_email    text not null,
  bill_to_company  text,
  bill_to_address  text,
  subtotal_usd     integer not null default 0,
  platform_fee_usd integer not null default 0,
  tax_usd          integer not null default 0,
  total_usd        integer not null default 0,
  currency         text not null default 'USD',
  status           text not null default 'draft'
                   check (status in ('draft','paid','void','refunded')),
  issued_at        timestamptz not null default now(),
  paid_at          timestamptz,
  payment_provider text,
  payment_ref      text,
  created_at       timestamptz not null default now()
);

-- ── applicants (creator self-registration) ─────────────────────────────────
create table if not exists public.applicants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  handle      text,
  platform    text,
  channel_url text,
  niche       text,
  audience    text,
  er          text,
  rate        text,
  email       text not null,
  phone       text,
  photo_url   text,
  video_url   text,
  notes       text,
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected')),
  admin_notes text,
  creator_id  uuid references public.creators(id) on delete set null,
  country     text,
  applied_at  timestamptz not null default now()
);

-- ── partnership_requests ───────────────────────────────────────────────────
create table if not exists public.partnership_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  company     text,
  email       text not null,
  phone       text,
  type        text,
  budget      text,
  description text,
  status      text not null default 'new'
              check (status in ('new','in_discussion','converted','closed')),
  assigned_to uuid references public.users(id) on delete set null,
  source      text not null default 'website',
  country     text,
  created_at  timestamptz not null default now()
);

-- ── booking_requests ───────────────────────────────────────────────────────
-- Leads captured when a visitor outside PAYMENT_ALLOWED_COUNTRIES tries to book.
create table if not exists public.booking_requests (
  id                uuid primary key default gen_random_uuid(),
  request_ref       text unique not null,            -- BM-REQ-2026-0001
  creator_id        uuid references public.creators(id) on delete set null,
  creator_name      text,
  campaign_id       uuid references public.campaigns(id) on delete set null,
  full_name         text not null,
  email             text not null,
  phone             text,
  company           text,
  website           text,
  preferred_contact text default 'email',
  budget            text,
  content_type      text,
  quantity          integer,
  message           text,
  country           text,
  region_blocked    boolean not null default true,
  status            text not null default 'new'
                    check (status in ('new','contacted','quoted','converted','closed')),
  admin_notes       text,
  handled_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists booking_requests_status_idx on public.booking_requests (status);

-- ── contact_messages ───────────────────────────────────────────────────────
create table if not exists public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  first_name   text,
  last_name    text,
  email        text not null,
  company      text,
  inquiry_type text,
  budget       text,
  message      text,
  country      text,
  status       text not null default 'new'
               check (status in ('new','in_progress','closed')),
  created_at   timestamptz not null default now()
);

-- ── import_batches ─────────────────────────────────────────────────────────
create table if not exists public.import_batches (
  id          uuid primary key default gen_random_uuid(),
  filename    text,
  total_rows  integer not null default 0,
  imported    integer not null default 0,
  duplicates  integer not null default 0,
  errors      integer not null default 0,
  status      text not null default 'completed',
  imported_by uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── email_log ──────────────────────────────────────────────────────────────
create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  to_email     text not null,
  from_email   text,
  subject      text not null,
  template     text,
  html         text,
  provider     text not null default 'console',
  provider_id  text,
  status       text not null default 'logged'
               check (status in ('sent','failed','logged')),
  error        text,
  related_type text,
  related_id   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);

-- ── saved_creators / contact_reveals ───────────────────────────────────────
create table if not exists public.saved_creators (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, creator_id)
);

create table if not exists public.contact_reveals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists reveals_user_day_idx on public.contact_reveals (user_id, created_at desc);

-- ── settings ───────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ── updated_at trigger ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists creators_touch on public.creators;
create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();

drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();
