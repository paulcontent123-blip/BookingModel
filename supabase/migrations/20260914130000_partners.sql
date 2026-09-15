-- ===========================================================================
-- Migration: partners
--
-- Partner profiles are managed by Admin and displayed on /partnership when
-- their status is published. Partnership requests remain in their separate
-- partnership_requests table.
-- ===========================================================================

create extension if not exists "pgcrypto";

create table if not exists public.partners (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_url     text,
  website_url  text,
  category     text,
  description  text,
  sort_order   integer not null default 0,
  status       text not null default 'draft'
               check (status in ('draft', 'published')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists partners_status_order_idx
  on public.partners (status, sort_order, name);

alter table public.partners enable row level security;

drop policy if exists "public reads published partners" on public.partners;
create policy "public reads published partners"
  on public.partners for select
  to anon, authenticated
  using (status = 'published');

drop trigger if exists partners_touch on public.partners;
create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();
