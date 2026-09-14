-- ===========================================================================
-- Migration: news_and_showcase
-- Created:   2026-09-10
--
-- Backs the public "News & Showcase" section with real content tables so the
-- articles are written in Admin instead of being hard-coded in data/*.json.
--
--   news_posts     -> /news and /news/[slug]
--   showcase_cases -> /showcase and /showcase/[slug]
--
-- Applied with:  npx supabase db push  (or paste into the SQL editor)
-- Idempotent: every object uses IF NOT EXISTS, so re-running is safe.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ── news_posts ─────────────────────────────────────────────────────────────
create table if not exists public.news_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  category         text not null default 'Case Study',
  title            text not null,
  excerpt          text,
  body             text,
  cover_url        text,
  emoji            text,
  accent_bg        text,
  author           text,
  seo_title        text,
  seo_description  text,
  featured         boolean not null default false,
  status           text not null default 'draft'
                   check (status in ('draft','published')),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists news_posts_status_idx
  on public.news_posts (status, published_at desc);
create index if not exists news_posts_category_idx
  on public.news_posts (category, published_at desc);

-- ── showcase_cases ─────────────────────────────────────────────────────────
create table if not exists public.showcase_cases (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  brand         text not null,
  title         text not null,
  tag           text not null default 'Showcase',
  summary       text,
  meta          text,
  challenge     text,
  approach      text,
  outcome       text,
  metrics       jsonb not null default '[]'::jsonb,
  platform      text,
  cover_url     text,
  emoji         text,
  accent_bg     text,
  sort_order    integer not null default 0,
  status        text not null default 'draft'
                check (status in ('draft','published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists showcase_cases_status_idx
  on public.showcase_cases (status, sort_order, published_at desc);

-- ── Row level security ─────────────────────────────────────────────────────
-- The app writes with the service role key (which bypasses RLS). These
-- policies only matter if the anon key ever reaches a browser: published
-- content is public, drafts are not readable and nothing is writable.
alter table public.news_posts     enable row level security;
alter table public.showcase_cases enable row level security;

drop policy if exists "public reads published news" on public.news_posts;
create policy "public reads published news"
  on public.news_posts for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "public reads published showcase" on public.showcase_cases;
create policy "public reads published showcase"
  on public.showcase_cases for select
  to anon, authenticated
  using (status = 'published');
