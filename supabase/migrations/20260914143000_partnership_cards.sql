-- Move the partnership cards that were previously hard-coded in the public
-- page into the database. The admin can edit their icon, copy and CTA.

alter table public.partners
  add column if not exists icon text,
  add column if not exists cta_label text;

-- The partners table was empty when this migration was prepared. Remove only
-- rows with these exact legacy card names so a re-run cannot duplicate them.
delete from public.partners
where name in (
  'Co-Marketing & Brand Collab',
  'Tech & Platform Integration',
  'Agency & Reseller Partnership',
  'Affiliate & Referral Program',
  'Creator Academy Partner',
  'Product Gifting Program'
);

insert into public.partners (
  name,
  icon,
  cta_label,
  description,
  sort_order,
  status
)
values
  ('Co-Marketing & Brand Collab', '🤝', 'Reach out →', 'Joint campaigns, co-branded content and cross-promotion to our combined audience of brands and creators.', 10, 'published'),
  ('Tech & Platform Integration', '🔗', 'Reach out →', 'API integrations, data partnerships and software tools embedded in our creator workflow.', 20, 'published'),
  ('Agency & Reseller Partnership', '🌐', 'Reach out →', 'White-label our creator discovery and booking infrastructure. Revenue sharing for qualified partners.', 30, 'published'),
  ('Affiliate & Referral Program', '📣', 'Join program →', 'Earn commission by referring brands to BookingModel. Monthly payouts, co-branded landing pages.', 40, 'published'),
  ('Creator Academy Partner', '🎓', 'Partner with us →', 'Educators and coaches who teach UGC — partner for joint workshops, certification and community access.', 50, 'published'),
  ('Product Gifting Program', '📦', 'Start gifting →', 'Send products to our creator roster for organic reviews and authentic UGC with content output guarantees.', 60, 'published');
