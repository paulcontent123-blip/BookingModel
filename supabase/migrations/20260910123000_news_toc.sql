-- Add the per-article table-of-contents preference without changing existing rows.
alter table if exists public.news_posts
  add column if not exists show_toc boolean not null default true;
