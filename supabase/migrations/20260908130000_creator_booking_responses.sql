-- Creator acceptance/decline workflow for paid bookings.
-- Existing deals are treated as already handled; only new paid bookings set
-- creator_response_status = 'pending' from the application.

alter table public.deals
  add column if not exists creator_response_status text not null default 'accepted',
  add column if not exists creator_response_token_hash text,
  add column if not exists creator_response_expires_at timestamptz,
  add column if not exists creator_responded_at timestamptz,
  add column if not exists refund_status text not null default 'not_required',
  add column if not exists refund_reason text,
  add column if not exists refunded_at timestamptz,
  add column if not exists payout_status text not null default 'not_due',
  add column if not exists payout_ref text;

create index if not exists deals_creator_response_idx
  on public.deals (creator_response_status, creator_response_expires_at);
create index if not exists deals_refund_status_idx
  on public.deals (refund_status);

comment on column public.deals.creator_response_token_hash is
  'SHA-256 hash of the one-time accept/decline token; the raw token is only sent by email.';
comment on column public.deals.payout_status is
  'Internal payout queue state. Actual creator payouts require Stripe Connect or PayPal Payouts.';
