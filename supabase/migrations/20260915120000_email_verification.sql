-- Email verification codes for newly registered brand accounts.
-- The users table stores only a hash; delivery follows the existing email-log behavior.

alter table public.users
  add column if not exists verification_code_hash text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verification_sent_at timestamptz,
  add column if not exists verification_attempts integer not null default 0;

create index if not exists users_verification_expiry_idx
  on public.users (verification_expires_at)
  where verification_code_hash is not null;
