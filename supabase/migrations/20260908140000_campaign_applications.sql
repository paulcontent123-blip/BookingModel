-- A creator can apply to a specific published campaign or to the general roster.
alter table public.applicants
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create index if not exists applicants_campaign_idx
  on public.applicants (campaign_id, applied_at desc);

-- The contact reveal quota is shared by roster creators and applicants.
alter table public.contact_reveals
  add column if not exists applicant_id uuid references public.applicants(id) on delete cascade;

alter table public.contact_reveals
  alter column creator_id drop not null;

alter table public.contact_reveals
  drop constraint if exists contact_reveals_one_target;

alter table public.contact_reveals
  add constraint contact_reveals_one_target
  check ((creator_id is not null) <> (applicant_id is not null));

create index if not exists reveals_applicant_idx
  on public.contact_reveals (user_id, applicant_id, created_at desc);
