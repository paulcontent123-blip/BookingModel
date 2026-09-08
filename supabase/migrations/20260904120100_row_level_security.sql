-- ===========================================================================
-- Migration: row_level_security
-- Created:   2026-09-04
--
-- Enables RLS on every table and defines the public read / public insert
-- policies. Depends on 20260904120000_initial_schema.
--
-- This app talks to Supabase with the SERVICE ROLE key from the server only —
-- the service role bypasses RLS by design. These policies matter the moment
-- anything reaches the browser with the anon key (a future realtime feed,
-- Supabase Auth, a mobile client), so they are deliberately restrictive:
-- the public may read the active creator roster and nothing else.
-- ===========================================================================

alter table public.users                enable row level security;
alter table public.creators             enable row level security;
alter table public.creator_portfolio    enable row level security;
alter table public.campaigns            enable row level security;
alter table public.deals                enable row level security;
alter table public.invoices             enable row level security;
alter table public.applicants           enable row level security;
alter table public.partnership_requests enable row level security;
alter table public.booking_requests     enable row level security;
alter table public.contact_messages     enable row level security;
alter table public.import_batches       enable row level security;
alter table public.email_log            enable row level security;
alter table public.saved_creators       enable row level security;
alter table public.contact_reveals      enable row level security;
alter table public.settings             enable row level security;

-- ── Public read: the marketplace ───────────────────────────────────────────
drop policy if exists "public reads active creators" on public.creators;
create policy "public reads active creators"
  on public.creators for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "public reads portfolio of active creators" on public.creator_portfolio;
create policy "public reads portfolio of active creators"
  on public.creator_portfolio for select
  to anon, authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = creator_portfolio.creator_id and c.status = 'active'
  ));

drop policy if exists "public reads active campaigns" on public.campaigns;
create policy "public reads active campaigns"
  on public.campaigns for select
  to anon, authenticated
  using (status = 'active');

-- ── Public write: the three lead forms ─────────────────────────────────────
-- Inserts only; nobody may read these back without the service role.
drop policy if exists "anyone may apply as creator" on public.applicants;
create policy "anyone may apply as creator"
  on public.applicants for insert to anon, authenticated with check (true);

drop policy if exists "anyone may submit a partnership request" on public.partnership_requests;
create policy "anyone may submit a partnership request"
  on public.partnership_requests for insert to anon, authenticated with check (true);

drop policy if exists "anyone may submit a booking request" on public.booking_requests;
create policy "anyone may submit a booking request"
  on public.booking_requests for insert to anon, authenticated with check (true);

drop policy if exists "anyone may submit a contact message" on public.contact_messages;
create policy "anyone may submit a contact message"
  on public.contact_messages for insert to anon, authenticated with check (true);

-- ── Everything else: service role only ─────────────────────────────────────
-- No policy is defined for users, deals, invoices, email_log, import_batches
-- or settings, so with RLS enabled the anon and authenticated roles cannot
-- read or write them at all. The Next.js server (service role) still can.
--
-- If you later migrate to Supabase Auth, replace the block below with policies
-- keyed on auth.uid(), e.g.:
--
--   create policy "brands read their own deals"
--     on public.deals for select to authenticated
--     using (brand_id = auth.uid());
--
--   create policy "brands read their own invoices"
--     on public.invoices for select to authenticated
--     using (brand_id = auth.uid());
