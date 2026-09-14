-- Brand profiles are separated from auth users so the account and internal
-- dashboard can manage real business information without bloating users.
create table if not exists public.brands (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.users(id) on delete cascade,
  brand_name     text not null,
  legal_name     text,
  website        text,
  industry       text,
  description    text,
  company_size   text,
  country        text not null default 'US',
  state          text,
  city           text,
  timezone       text,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  linkedin_url   text,
  instagram_url  text,
  tiktok_url     text,
  avatar_url     text,
  status         text not null default 'active'
                 check (status in ('active', 'inactive', 'pending')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists brands_name_idx on public.brands (lower(brand_name));
create index if not exists brands_status_idx on public.brands (status);

alter table public.brands enable row level security;

-- The application uses the server-side service role driver for this table.
-- No anon policies are intentionally exposed.

insert into public.brands (
  user_id, brand_name, country, contact_name, contact_email, status
)
select
  u.id,
  coalesce(nullif(trim(u.company_name), ''), nullif(trim(u.full_name), ''), split_part(u.email, '@', 1)),
  coalesce(nullif(trim(u.country), ''), 'US'),
  u.full_name,
  u.email,
  'active'
from public.users u
where u.role in ('brand', 'agency')
on conflict (user_id) do nothing;

drop trigger if exists brands_touch on public.brands;
create trigger brands_touch before update on public.brands
  for each row execute function public.touch_updated_at();
