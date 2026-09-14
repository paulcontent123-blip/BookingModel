-- Add an optional Cloudinary delivery URL for campaign cards.
alter table public.campaigns
  add column if not exists cover_url text;
