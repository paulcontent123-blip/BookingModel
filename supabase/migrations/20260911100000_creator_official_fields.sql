-- ===========================================================================
-- Migration: creator_official_fields
-- Created:   2026-09-11
--
-- Fields used by the official BookingModel_US_20_Creator.xlsx source file.
-- A creator handle is unique within a platform, not globally: one person can
-- have the same username on Instagram and TikTok.
-- ===========================================================================

alter table public.creators
  add column if not exists avg_views_likes bigint,
  add column if not exists location text,
  add column if not exists avatar_filename text;

alter table public.creators
  drop constraint if exists creators_handle_key;

create unique index if not exists creators_platform_handle_unique_idx
  on public.creators (lower(platform), lower(handle));

create index if not exists creators_location_idx
  on public.creators (location);
