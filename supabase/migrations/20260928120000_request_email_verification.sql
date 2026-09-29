-- Confirm the sender's email before a public request is persisted.
-- The code is stored only as a keyed hash; the pending payload is deleted
-- after the request is created or when delivery cannot be completed.

create table if not exists public.request_email_verifications (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('contact', 'partnership', 'booking_request', 'applicant')),
  email text not null,
  payload jsonb not null,
  code_hash text not null,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  attempts integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists request_email_verifications_email_idx
  on public.request_email_verifications (email, created_at desc);

create index if not exists request_email_verifications_expiry_idx
  on public.request_email_verifications (expires_at)
  where verified_at is null;

alter table public.request_email_verifications enable row level security;
